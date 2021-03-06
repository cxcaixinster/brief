/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

const THROBBER_URL = 'chrome://brief/skin/throbber.gif';
const ERROR_ICON_URL = 'chrome://brief/skin/icons/error.png';

var ViewList = {

    get richlistbox() {
        delete this.richlistbox;
        return this.richlistbox = getElement('view-list');
    },

    get selectedItem() {
        return this.richlistbox.selectedItem;
    },

    set selectedItem(aItem) {
        this.richlistbox.selectedItem = aItem;
        return aItem;
    },

    init: function ViewList_init() {
        this.refreshItem('unread-folder');
        this.refreshItem('starred-folder');
    },

    deselect: function ViewList_deselect() {
        this.richlistbox.selectedIndex = -1;
    },

    onSelect: function ViewList_onSelect(aEvent) {
        if (!this.selectedItem)
            return;

        TagList.deselect();
        FeedList.deselect();

        var title = this.selectedItem.getAttribute('name');
        var query = new Query();

        switch (this.selectedItem.id) {
            case 'all-items-folder':
                query.deleted = Storage.ENTRY_STATE_NORMAL;
                break;

            case 'unread-folder':
                query.deleted = Storage.ENTRY_STATE_NORMAL;
                query.read = false;
                break;

            case 'starred-folder':
                query.deleted = Storage.ENTRY_STATE_NORMAL;
                query.starred = true;

                if (TagList.tags.length)
                    TagList.show();
                break;

            case 'trash-folder':
                query.deleted = Storage.ENTRY_STATE_TRASHED;
                break;
        }

        gCurrentView = new FeedView(title, query);
    },

    // If there is a webpage open in the browser then clicking on
    // the already selected item, should bring back the feed view.
    onClick: function ViewList_onClick(aEvent) {
        // Find the target richlistitem in the event target's parent chain
        var targetItem = aEvent.target;
        while (targetItem) {
            if (targetItem.localName == 'richlistitem')
                break;
            targetItem = targetItem.parentNode;
        }

        if (!gCurrentView.active && targetItem && aEvent.button == 0)
            gCurrentView.browser.loadURI(gTemplateURI.spec);
    },

    refreshItem: function ViewList_refreshItem(aItemID) {
        var item = getElement(aItemID);

        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            read: false,
            starred: (aItemID == 'starred-folder') ? true : undefined
        })

        var unreadCount = query.getEntryCount();
        var name = item.getAttribute('name');
        if (unreadCount > 0) {
            name += ' (' + unreadCount +')';
            item.setAttribute('unread', true);
        }
        else {
            item.removeAttribute('unread');
        }

        var label = item.lastChild;
        label.setAttribute('value', name);
    }

}


var TagList = {

    ready: false,

    get tags() {
        if (!this.__tags)
            this.__tags = Storage.getAllTags();
        return this.__tags;
    },

    set tags(aTags) {
        this.__tags = aTags;
        return aTags;
    },

    get selectedItem() {
        return this._listbox.selectedItem;
    },

    get _listbox() {
        delete this._listbox;
        return this._listbox = getElement('tag-list');
    },

    show: function TagList_show() {
        if (!this.ready)
            this._rebuild();

        if (this._listbox.hidden) {
            this._listbox.hidden = false;
            getElement('tag-list-splitter').hidden = false;
        }
    },

    hide: function TagList_hide() {
        if (!this._listbox.hidden) {
            this._listbox.hidden = true;
            getElement('tag-list-splitter').hidden = true;
        }
    },

    deselect: function TagList_deselect() {
        this._listbox.selectedIndex = -1;
    },

    onSelect: function TagList_onSelect(aEvent) {
        if (!this.selectedItem) {
            this.hide();
            return;
        }

        ViewList.deselect();
        FeedList.deselect();

        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            tags: [this.selectedItem.id]
        })

        gCurrentView = new FeedView(this.selectedItem.id, query);
    },

    // If there is a webpage open in the browser then clicking on
    // the already selected item, should bring back the feed view.
    onClick: function TagList_onClick(aEvent) {
        if (!gCurrentView.active && aEvent.target.localName != 'listitem' && aEvent.button == 0)
            gCurrentView.browser.loadURI(gTemplateURI.spec);
    },

    /**
     * Refreshes tag listitems.
     *
     * @param aTags            A tag string or an array of tag strings.
     * @param aPossiblyAdded   Indicates that the tag may not be in the list of tags yet.
     * @param aPossiblyRemoved Indicates that there may be no remaining entries with
     *                         the tag.
     */
    refreshTags: function TagList_refreshTags(aTags, aPossiblyAdded, aPossiblyRemoved) {
        if (!this.ready)
            return;

        var tags = (aTags.splice) ? aTags : [aTags];

        for (let i = 0; i < tags.length; i++) {
            let tag = tags[i];

            if (aPossiblyAdded) {
                if (this.tags.indexOf(tag) == -1) {
                    this._rebuild();
                    break;
                }
            }
            else if (aPossiblyRemoved) {
                if (!new Query({ tags: [tag] }).hasMatches()) {
                    this._rebuild();
                    if (gCurrentView.query.tags && gCurrentView.query.tags[0] === tag)
                        ViewList.selectedItem = getElement('starred-folder');
                    break;
                }
            }

            this._refreshLabel(tag);
        }
    },

    _rebuild: function TagList__rebuild() {
        while (this._listbox.hasChildNodes())
            this._listbox.removeChild(this._listbox.lastChild);

        this.tags = Storage.getAllTags();

        for (let i = 0; i < this.tags.length; i++) {
            let item = document.createElement('listitem');
            item.id = this.tags[i];
            item.className = 'listitem-iconic tag-list-item';
            item.setAttribute('image', 'chrome://brief/skin/icons/tag.png');
            this._listbox.appendChild(item);

            this._refreshLabel(this.tags[i]);
        }

        this.ready = true;
    },

    _refreshLabel: function TagList__refreshLabel(aTagName) {
        let query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            tags: [aTagName],
            read: false
        })

        var unreadCount = query.getEntryCount();

        var listitem = getElement(aTagName);
        var name = aTagName;
        if (unreadCount > 0) {
            name += ' (' + unreadCount +')';
            listitem.setAttribute('unread', true);
        }
        else {
            listitem.removeAttribute('unread');
        }

        listitem.setAttribute('label', name);
    }

}


var FeedList = {

    get tree() {
        delete this.tree;
        return this.tree = getElement('feed-list');
    },

    // All treeitems in the tree.
    items: null,

    _lastSelectedItem: null,

    ignoreSelectEvent: false,

    treeReady: false,

    get selectedItem() {
        var item = null;
        var currentIndex = this.tree.currentIndex;
        if (currentIndex != -1 && currentIndex < this.tree.view.rowCount)
            item = this.tree.view.getItemAtIndex(currentIndex);
        return item;
    },

    // Feed object of currently selected feed, or null.
    get selectedFeed() {
        if (!this.selectedItem)
            return null;

        var feed = null;
        var feedID = this.selectedItem.id;
        if (feedID)
            feed = Storage.getFeed(feedID);
        return feed;
    },

    deselect: function FeedList_deselect() {
        this.tree.view.selection.select(-1);
    },

    onSelect: function FeedList_onSelect(aEvent) {
        var selectedItem = this.selectedItem;
        if (!selectedItem) {
            this._lastSelectedItem = null;
            return;
        }

        if (this.ignoreSelectEvent || this._lastSelectedItem == selectedItem)
            return;

        ViewList.deselect();
        TagList.deselect();

        // Clicking the twisty also triggers the select event, although the selection
        // doesn't change. We remember the previous selected item and do nothing when
        // the new selected item is the same.
        this._lastSelectedItem = selectedItem;

        var query = new Query({ deleted: Storage.ENTRY_STATE_NORMAL });

        if (selectedItem.hasAttribute('container'))
            query.folders = [this.selectedFeed.feedID];
        else
            query.feeds = [this.selectedFeed.feedID];

        gCurrentView = new FeedView(this.selectedFeed.title, query);
    },


    onClick: function FeedList_onClick(aEvent) {
        var row = FeedList.tree.treeBoxObject.getRowAt(aEvent.clientX, aEvent.clientY);
        if (row != -1) {
            var item = FeedList.tree.view.getItemAtIndex(row);

            // Detect when folder is collapsed/expanded.
            if (item.hasAttribute('container')) {
                // This must be done asynchronously, because this listener was called
                // during capture and the folder hasn't actually been opened or closed yet.
                async(function() FeedList.refreshFolderTreeitems([item.id]));

                // Folder states must be persisted immediatelly instead of when
                // Brief is closed, because otherwise if the feedlist is rebuilt,
                // the changes will be lost.
                async(FeedList._persistFolderState, 0, FeedList);
            }

            // If there is a webpage open in the browser then clicking on
            // the already selected item, should bring back the feed view.
            if (!gCurrentView.active && item == FeedList.selectedItem && aEvent.button == 0)
                gCurrentView.browser.loadURI(gTemplateURI.spec);
        }
    },


    onKeyUp: function FeedList_onKeyUp(aEvent) {
        var isContainer = this.selectedItem.hasAttribute('container');
        if (isContainer && aEvent.keyCode == aEvent.DOM_VK_RETURN) {
            if (this.selectedItem.id != 'starred-folder')
                this.refreshFolderTreeitems([this.selectedItem.id]);

            async(this._persistFolderState, 0, this);
        }
    },

    // Sets the visibility of context menuitem depending on the target.
    onContextMenuShowing: function FeedList_onContextMenuShowing(aEvent) {
        var row = this.tree.treeBoxObject.getRowAt(aEvent.clientX, aEvent.clientY);
        if (row == -1) {
            aEvent.preventDefault(); // Target is empty space.
        }
        else {
            let target = this.tree.view.getItemAtIndex(row);
            FeedListContextMenu.init(target);
        }
    },

    /**
     * Refresh the folder's label.
     *
     * @param aFolders
     *        An array of feed IDs.
     */
    refreshFolderTreeitems: function FeedList_refreshFolderTreeitems(aFolders) {
        if (!this.treeReady)
            return;

        for (let i = 0; i < aFolders.length; i++) {
            let folder = Storage.getFeed(aFolders[i]);
            let treeitem = getElement(folder.feedID);

            if (treeitem.getAttribute('open') == 'true') {
                let treecell = getElement(folder.feedID).firstChild.firstChild;
                this.removeProperty(treecell, 'unread');
                treecell.setAttribute('label', folder.title);
            }
            else {
                this._refreshLabel(folder);
            }
        }
    },

    /**
     * Refresh the feed treeitem's label and favicon. Also refreshes folders
     * in the feed's parent chain.
     *
     * @param aFeeds
     *        An array of feed IDs.
     */
    refreshFeedTreeitems: function FeedList_refreshFeedTreeitems(aFeeds) {
        if (!this.treeReady)
            return;

        for (let i = 0; i < aFeeds.length; i++) {
            let feed = Storage.getFeed(aFeeds[i]);
            this._refreshLabel(feed);
            this._refreshFavicon(feed.feedID);

            // FeedList.items is null before the tree finishes building. We don't need to
            // refresh the parent folders then, anyway, because _buildFolderChildren does
            // it itself.
            if (this.items) {
                // Build an array of IDs of folders in the the parent chains of
                // the given feeds.
                let folders = [];
                let parentID = feed.parent;

                while (parentID != PrefCache.homeFolder) {
                    if (folders.indexOf(parentID) == -1)
                        folders.push(parentID);
                    parentID = Storage.getFeed(parentID).parent;
                }

                this.refreshFolderTreeitems(folders);
            }
        }
    },

    _refreshLabel: function FeedList__refreshLabel(aFeed) {
        let query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            folders: aFeed.isFolder ? [aFeed.feedID] : undefined,
            feeds: aFeed.isFolder ? undefined : [aFeed.feedID],
            read: false
        })

        var unreadCount = query.getEntryCount();

        var treecell = getElement(aFeed.feedID).firstChild.firstChild;
        var label;
        if (unreadCount > 0) {
            label = aFeed.title + ' (' + unreadCount +')';
            this.setProperty(treecell, 'unread');
        }
        else {
            label = aFeed.title;
            this.removeProperty(treecell, 'unread');
        }

        treecell.setAttribute('label', label);
    },

    _refreshFavicon: function FeedList__refreshFavicon(aFeedID) {
        var feed = Storage.getFeed(aFeedID);
        var treeitem = getElement(aFeedID);
        var treecell = treeitem.firstChild.firstChild;

        // Update the favicon.
        if (treeitem.hasAttribute('loading'))
            treecell.setAttribute('src', THROBBER_URL);
        else if (treeitem.hasAttribute('error'))
            treecell.setAttribute('src', ERROR_ICON_URL);
        else if (PrefCache.showFavicons && feed.favicon != 'no-favicon')
            treecell.setAttribute('src', feed.favicon);
        else
            treecell.removeAttribute('src');
    },

    rebuild: function FeedList_rebuild() {
        // Can't build the tree if it is hidden and has no view.
        if (!this.tree.view)
            return;

        this.treeReady = true;

        // Remember selection.
        this.lastSelectedID = this.selectedItem ? this.selectedItem.id : '';

        // Clear the existing tree.
        var topLevelChildren = getElement('top-level-children');
        while (topLevelChildren.hasChildNodes())
            topLevelChildren.removeChild(topLevelChildren.lastChild);

        this.feeds = Storage.getAllFeeds(true);

        // This a helper array used by _buildFolderChildren. As the function recurses,
        // the array stores the <treechildren> elements of all folders in the parent
        // chain of the currently processed folder. This is how it tracks where to
        // append the items.
        this._folderParentChain = [topLevelChildren];

        this._buildFolderChildren(PrefCache.homeFolder);

        this._restoreSelection();

        // Fill the items cache.
        this.items = this.tree.getElementsByTagName('treeitem');
    },

    // Cached document fragments, "bricks" used to build the tree.
    get _containerRow() {
        delete this._containerRow;

        this._containerRow = document.createDocumentFragment();

        var treeitem = document.createElement('treeitem');
        treeitem.setAttribute('container', 'true');
        treeitem = this._containerRow.appendChild(treeitem);

        var treerow = document.createElement('treerow');
        treerow = treeitem.appendChild(treerow);

        var treecell = document.createElement('treecell');
        treecell = treerow.appendChild(treecell);

        var treechildren = document.createElement('treechildren');
        treechildren = treeitem.appendChild(treechildren);

        return this._containerRow;
    },

    get _flatRow() {
        delete this._flatRow;

        this._flatRow = document.createDocumentFragment();

        var treeitem = document.createElement('treeitem');
        treeitem = this._flatRow.appendChild(treeitem);

        var treerow = document.createElement('treerow');
        treeitem.appendChild(treerow);

        var treecell = document.createElement('treecell');
        treerow.appendChild(treecell);

        return this._flatRow;
    },

    /**
     * Recursively reads feeds from the database and builds the tree, starting from the
     * given folder.
     *
     * @param aParentFolder feedID of the folder.
     */
    _buildFolderChildren: function FeedList__buildFolderChildren(aParentFolder) {
        // Iterate over all feeds to find the children.
        for (var i = 0; i < this.feeds.length; i++) {
            var feed = this.feeds[i];

            if (feed.parent != aParentFolder)
                continue;

            var parent = this._folderParentChain[this._folderParentChain.length - 1];

            if (feed.isFolder) {
                var closedFolders = this.tree.getAttribute('closedFolders');
                var isOpen = !closedFolders.match(escape(feed.feedID));

                var fragment = this._containerRow.cloneNode(true);
                var treeitem = fragment.firstChild;
                treeitem.setAttribute('open', isOpen);
                treeitem.setAttribute('id', feed.feedID);

                parent.appendChild(fragment);

                this.refreshFolderTreeitems([feed.feedID]);

                this._folderParentChain.push(treeitem.lastChild);

                this._buildFolderChildren(feed.feedID);
            }
            else {
                var fragment = this._flatRow.cloneNode(true);
                var treeitem = fragment.firstChild;
                treeitem.setAttribute('id', feed.feedID);
                treeitem.setAttribute('url', feed.feedURL);

                var treecell = treeitem.firstChild.firstChild;
                treecell.setAttribute('properties', 'feed-item ');

                parent.appendChild(fragment);

                this.refreshFeedTreeitems([feed.feedID]);
            }
        }
        this._folderParentChain.pop();
    },

    _restoreSelection: function FeedList__restoreSelection() {
        if (!this.lastSelectedID)
            return;

        var itemToSelect = getElement(this.lastSelectedID);
        if (itemToSelect) {
            let index = this.tree.view.getIndexOfItem(itemToSelect);
            this.ignoreSelectEvent = true;
            this.tree.view.selection.select(index);
            this.ignoreSelectEvent = false;
        }
        else {
            this.tree.view.selection.select(0);
        }

        this.lastSelectedID = '';
    },


    observe: function FeedList_observe(aSubject, aTopic, aData) {
        switch (aTopic) {

        // The Live Bookmarks stored is user's folder of choice were read and the
        // in-database list of feeds was synchronized.
        case 'brief:invalidate-feedlist':
            this.rebuild();
            async(gCurrentView.refresh, 0, gCurrentView);
            break;

        case 'brief:feed-title-changed':
            var feed = Storage.getFeed(aData);
            if (feed.isFolder)
                this.refreshFolderTreeitems([aData]);
            else
                this.refreshFeedTreeitems([aData]);
            break;

        case 'brief:feed-updated':
            if (this.treeReady) {
                let item = getElement(aData);
                item.removeAttribute('error');
                item.removeAttribute('loading');
                this._refreshFavicon(aData);
            }
            refreshProgressmeter();
            break;

        case 'brief:feed-loading':
            if (this.treeReady) {
                let item = getElement(aData);
                item.setAttribute('loading', true);
                this._refreshFavicon(aData);
            }
            break;

        // Error occured when downloading or parsing the feed, show error icon.
        case 'brief:feed-error':
            if (this.treeReady) {
                let item = getElement(aData);
                item.setAttribute('error', true);
                this._refreshFavicon(aData);
            }
            break;

        case 'brief:feed-update-queued':
            getElement('update-buttons-deck').selectedIndex = 1;

            if (FeedUpdateService.scheduledFeedsCount > 1) {
                getElement('update-progress-deck').selectedIndex = 1;
                refreshProgressmeter();
            }
            break;

        case 'brief:feed-update-canceled':
            getElement('update-progress-deck').selectedIndex = 0;
            getElement('update-buttons-deck').selectedIndex = 0;
            getElement('update-progress').value = 0;

            Storage.getAllFeeds().forEach(function(feed) {
                let item = getElement(feed.feedID);
                if (item.hasAttribute('loading')) {
                    item.removeAttribute('loading');
                    this._refreshFavicon(feed.feedID);
                }
            }, this)
            break;

        case 'brief:custom-style-changed':
            gCurrentView.browser.loadURI(gTemplateURI.spec);
            break;
        }
    },


    onEntriesAdded: function FeedList_onEntriesAdded(aEntryList) {
        async(function() {
            this.refreshFeedTreeitems(aEntryList.feedIDs);
            ViewList.refreshItem('unread-folder');

            /*if (aEntryList.containsStarred()) {
                ViewList.refreshItem('starred-folder');
                TagList.refreshTags(aEntryList.tags, true);
            }*/
        }, 0, this)
    },

    onEntriesUpdated: function FeedList_onEntriesUpdated(aEntryList) {
        async(function() {
            if (aEntryList.containsUnread()) {
                this.refreshFeedTreeitems(aEntryList.feedIDs);
                ViewList.refreshItem('unread-folder');
                TagList.refreshTags(aEntryList.tags);
            }
        }, 0, this)
    },

    onEntriesMarkedRead: function FeedList_onEntriesMarkedRead(aEntryList, aNewState) {
        async(function() {
            this.refreshFeedTreeitems(aEntryList.feedIDs);
            ViewList.refreshItem('unread-folder');

            if (aEntryList.containsStarred()) {
                ViewList.refreshItem('starred-folder');
                TagList.refreshTags(aEntryList.tags);
            }
        }, 0, this)
    },

    onEntriesStarred: function FeedList_onEntriesStarred(aEntryList, aNewState) {
        async(function() {
            if (aEntryList.containsUnread())
                ViewList.refreshItem('starred-folder');
        }, 0, this)
    },

    onEntriesTagged: function FeedList_onEntriesTagged(aEntryList, aNewState, aTag) {
        async(function() {
            TagList.refreshTags(aTag, aNewState, !aNewState);
        }, 0, this)
    },

    onEntriesDeleted: function FeedList_onEntriesDeleted(aEntryList, aNewState) {
        async(function() {
            if (aEntryList.containsUnread()) {
                this.refreshFeedTreeitems(aEntryList.feedIDs);
                ViewList.refreshItem('unread-folder');

                if (aEntryList.containsStarred())
                    ViewList.refreshItem('starred-folder');
            }

            var entriesRestored = (aNewState == Storage.ENTRY_STATE_NORMAL);
            TagList.refreshTags(aEntryList.tags, entriesRestored, !entriesRestored);
        }, 0, this)
    },


    _persistFolderState: function FeedList_persistFolderState() {
        // Persist the folders open/closed state.
        var closedFolders = '';
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (item.hasAttribute('container') && item.getAttribute('open') == 'false')
                closedFolders += item.id;
        }
        FeedList.tree.setAttribute('closedFolders', escape(closedFolders));

        var starredFolder = getElement('starred-folder');
        starredFolder.setAttribute('wasOpen', starredFolder.getAttribute('open'));
    },


    setProperty: function FeedList_setProperty(aItem, aProperty) {
        var properties = aItem.getAttribute('properties');
        if (!properties.match(aProperty + ' '))
            aItem.setAttribute('properties', properties + aProperty + ' ');
    },

    removeProperty: function FeedList_removeProperty(aItem, aProperty) {
        var properties = aItem.getAttribute('properties');
        if (properties.match(aProperty)) {
            properties = properties.replace(aProperty + ' ', '');
            aItem.setAttribute('properties', properties);
        }
    },

    QueryInterface: function FeedList_QueryInterface(aIID) {
        if (aIID.equals(Ci.nsISupports) ||
            aIID.equals(Ci.nsIObserver)) {
            return this;
        }
        throw Components.results.NS_ERROR_NO_INTERFACE;
    }

}



var ViewListContextMenu = {

    targetItem: null,

    get targetIsAllItemsFolder() this.targetItem.id == 'all-items-folder',
    get targetIsUnreadFolder()   this.targetItem.id == 'unread-folder',
    get targetIsStarredFolder()  this.targetItem.id == 'starred-folder',
    get targetIsTrashFolder()    this.targetItem.id == 'trash-folder',

    init: function ViewListContextMenu_init(aTargetItem) {
        this.targetItem = aTargetItem;

        getElement('ctx-mark-special-folder-read').hidden = !this.targetIsUnreadFolder &&
                                                            !this.targetIsTrashFolder &&
                                                            !this.targetIsStarredFolder &&
                                                            !this.targetIsAllItemsFolder;
        getElement('ctx-mark-tag-read').hidden = !this.targetIsTag;
        getElement('ctx-restore-trashed').hidden = !this.targetIsTrashFolder;
        getElement('ctx-view-list-separator').hidden = !this.targetIsTag &&
                                                       !this.targetIsTrashFolder &&
                                                       !this.targetIsUnreadFolder;
        getElement('ctx-delete-tag').hidden = !this.targetIsTag;
        getElement('ctx-empty-unread-folder').hidden = !this.targetIsUnreadFolder;
        getElement('ctx-empty-trash').hidden = !this.targetIsTrashFolder;
    },

    markFolderRead: function ViewListContextMenu_markFolderRead() {
        var query = new Query();

        if (this.targetIsUnreadFolder) {
            query.deleted = Storage.ENTRY_STATE_NORMAL;
            query.read = false;
        }
        else if (this.targetIsStarredFolder) {
            query.deleted = Storage.ENTRY_STATE_NORMAL;
            query.starred = true;
        }
        else if (this.targetIsTrashFolder) {
            query.deleted = Storage.ENTRY_STATE_TRASHED;
        }

        query.markEntriesRead(true);
    },

    restoreTrashed: function ViewListContextMenu_restoreTrashed() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_TRASHED
        })
        query.deleteEntries(Storage.ENTRY_STATE_NORMAL);
    },

    emptyUnreadFolder: function ViewListContextMenu_emptyUnreadFolder() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            starred: false,
            read: false
        })
        query.deleteEntries(Storage.ENTRY_STATE_TRASHED);
    },

    emptyTrash: function gCurrentViewContextMenu_emptyTrash() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_TRASHED
        })
        query.deleteEntries(Storage.ENTRY_STATE_DELETED);

        var dialogTitle = gStringBundle.getString('compactPromptTitle');
        var dialogText = gStringBundle.getString('compactPromptText');
        var dialogConfirmLabel = gStringBundle.getString('compactPromptConfirmButton');

        var buttonFlags = Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
                          Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_NO +
                          Services.prompt.BUTTON_POS_0_DEFAULT;

        var shouldCompact = Services.prompt.confirmEx(window, dialogTitle, dialogText,
                                                      buttonFlags, dialogConfirmLabel,
                                                      null, null, null, {value:0});

        if (shouldCompact === 0) {
            window.openDialog('chrome://brief/content/compacting-progress.xul', 'Brief',
                              'chrome,titlebar,centerscreen');
        }
    }

}


var TagListContextMenu = {

    targetItem: null,

    markTagRead: function TagListContextMenu_markTagRead() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            tags: [this.targetItem.id]
        })
        query.markEntriesRead(true);
    },

    deleteTag: function TagListContextMenu_deleteTag() {
        var taggingService = Cc['@mozilla.org/browser/tagging-service;1'].
                             getService(Ci.nsITaggingService);

        var tag = this.targetItem.id;

        var dialogTitle = gStringBundle.getString('confirmTagDeletionTitle');
        var dialogText = gStringBundle.getFormattedString('confirmTagDeletionText', [tag]);

        var weHaveAGo = Services.prompt.confirm(window, dialogTitle, dialogText);

        if (weHaveAGo) {
            var urls = new Query({ tags: [tag] }).getProperty('entryURL', true)
                                                 .map(function(e) e.entryURL);

            for (let i = 0; i < urls.length; i++) {
                try {
                    var uri = NetUtil.newURI(urls[i], null, null);
                }
                catch (ex) {
                    continue;
                }
                taggingService.untagURI(uri, [tag]);
            }
        }
    }

}


var FeedListContextMenu = {

    targetItem: null,

    get targetID() this.targetItem.id,
    get targetFeed() Storage.getFeed(this.targetID),

    get targetIsFeed() this.targetItem.hasAttribute('url'),
    get targetIsFolder() this.targetItem.hasAttribute('container'),


    init: function FeedListContextMenu_init(aTargetItem) {
        this.targetItem = aTargetItem;

        getElement('ctx-mark-feed-read').hidden = !this.targetIsFeed;
        getElement('ctx-mark-folder-read').hidden = !this.targetIsFolder;
        getElement('ctx-update-feed').hidden = !this.targetIsFeed;
        getElement('ctx-update-folder').hidden = !this.targetIsFolder;

        var openWebsite = getElement('ctx-open-website');
        openWebsite.hidden = !this.targetIsFeed;
        if (this.targetIsFeed)
            openWebsite.disabled = !Storage.getFeed(this.targetItem.id).websiteURL;

        getElement('ctx-properties-separator').hidden = !this.targetIsFeed;
        getElement('ctx-feed-properties').hidden = !this.targetIsFeed;

        // Menuitems related to deleting feeds and folders.
        getElement('ctx-delete-feed').hidden = !this.targetIsFeed;
        getElement('ctx-delete-folder').hidden = !this.targetIsFolder;

        // Menuitems related to emptying feeds and folders.
        getElement('ctx-empty-feed').hidden = !this.targetIsFeed;
        getElement('ctx-empty-folder').hidden = !this.targetIsFolder;
    },


    markFeedRead: function FeedListContextMenu_markFeedRead() {
        var query = new Query({
            feeds: [this.targetID],
            deleted: Storage.ENTRY_STATE_NORMAL
        })
        query.markEntriesRead(true);
    },


    markFolderRead: function FeedListContextMenu_markFolderRead() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            folders: [this.targetID]
        })
        query.markEntriesRead(true);
    },


    updateFeed: function FeedListContextMenu_updateFeed() {
        FeedUpdateService.updateFeeds([this.targetFeed]);
    },


    updateFolder: function FeedListContextMenu_updateFolder() {
        var items = this.targetItem.getElementsByTagName('treeitem');
        var feeds = [];

        for (let i = 0; i < items.length; i++) {
            if (!items[i].hasAttribute('container'))
                feeds.push(Storage.getFeed(items[i].id));
        }

        FeedUpdateService.updateFeeds(feeds);
    },


    openWebsite: function FeedListContextMenu_openWebsite() {
        var url = this.targetFeed.websiteURL;
        getTopWindow().gBrowser.loadOneTab(url);
    },


    emptyFeed: function FeedListContextMenu_emptyFeed() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            starred: false,
            feeds: [this.targetID]
        })
        query.deleteEntries(Storage.ENTRY_STATE_TRASHED);
    },


    emptyFolder: function FeedListContextMenu_emptyFolder() {
        var query = new Query({
            deleted: Storage.ENTRY_STATE_NORMAL,
            starred: false,
            folders: [this.targetID]
        })
        query.deleteEntries(Storage.ENTRY_STATE_TRASHED);
    },


    deleteFeed: function FeedListContextMenu_deleteFeed() {
        var title = gStringBundle.getString('confirmFeedDeletionTitle');
        var text = gStringBundle.getFormattedString('confirmFeedDeletionText',
                                                   [this.targetFeed.title]);
        var weHaveAGo = Services.prompt.confirm(window, title, text);

        if (weHaveAGo) {
            this._removeTreeitem(this.targetItem);
            this._deleteBookmarks([this.targetFeed]);
        }
    },


    deleteFolder: function FeedListContextMenu_deleteFolder() {
        var title = gStringBundle.getString('confirmFolderDeletionTitle');
        var text = gStringBundle.getFormattedString('confirmFolderDeletionText',
                                                   [this.targetFeed.title]);
        var weHaveAGo = Services.prompt.confirm(window, title, text);

        if (weHaveAGo) {
            this._removeTreeitem(this.targetItem);

            var items = this.targetItem.getElementsByTagName('treeitem');
            var feeds = [this.targetFeed];
            for (let i = 0; i < items.length; i++)
                feeds.push(Storage.getFeed(items[i].id));

            this._deleteBookmarks(feeds);
        }
    },


    // Removes a treeitem and updates selection if it was selected.
    _removeTreeitem: function FeedListContextMenu__removeTreeitem(aTreeitem) {
        var treeview = FeedList.tree.view;
        var currentIndex = treeview.selection.currentIndex;
        var rowCount = treeview.rowCount;
        var indexToSelect = -1;

        if (FeedList.selectedItem == aTreeitem) {
            if (currentIndex == rowCount - 1)
                indexToSelect = treeview.getIndexOfItem(aTreeitem.previousSibling);
            else
                indexToSelect = currentIndex;
        }

        aTreeitem.parentNode.removeChild(aTreeitem);

        if (indexToSelect != -1)
            async(treeview.selection.select, 0, treeview.selection, indexToSelect);
    },


    _deleteBookmarks: function FeedListContextMenu__deleteBookmarks(aFeeds) {
        Components.utils.import('resource:///modules/PlacesUIUtils.jsm');
        transSrv = PlacesUIUtils.ptm;

        var transactions = [];
        for (let i = aFeeds.length - 1; i >= 0; i--)
            transactions.push(transSrv.removeItem(aFeeds[i].bookmarkID));

        var txn = transSrv.aggregateTransactions('Remove items', transactions);
        transSrv.doTransaction(txn);
    },


    showFeedProperties: function FeedListContextMenu_showFeedProperties() {
        openDialog('chrome://brief/content/options/feed-properties.xul', 'FeedProperties',
                   'chrome,titlebar,toolbar,centerscreen,modal', this.targetID);
    }

}
