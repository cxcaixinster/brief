const BRIEF_URL = 'chrome://brief/content/brief.xul';

var gBrief = {
  
  tab: null,        // Tab in which Brief is loaded
  statusIcon: null, // Statusbar panel
  button: null,     // Toolbar button

  openBrief: function(aNewTab) {
    // If Brief is already open then select the existing tab.
    if (this.tab)  
      gBrowser.selectedTab = this.tab;
    else if (aNewTab) {
      this.tab = gBrowser.loadOneTab(BRIEF_URL, null, null, null, false);
      var browser = gBrowser.getBrowserForTab(this.tab);
      browser.addEventListener('load', this.onBriefTabLoad, true);
    }
    else {
      gBrowser.loadURI(BRIEF_URL, null, null);
      this.tab = gBrowser.selectedTab;
      var browser = gBrowser.getBrowserForTab(this.tab);
      browser.addEventListener('load', this.onBriefTabLoad, true);
    }
    
    if (this.button)
      this.button.checked = true;
	},

 
  updateFeeds: function() {
    var updateService = Cc['@mozilla.org/brief/updateservice;1'].
                        createInstance(Ci.nsIBriefUpdateService);
    updateService.fetchAllFeeds();
  },
  
  
  updateStatuspanel: function() {
    var counter = document.getElementById('brief-status-counter');
    var panel = document.getElementById('brief-status');
    
    var storageService = Cc['@mozilla.org/brief/storage;1'].
                         createInstance(Ci.nsIBriefStorage);
    var unreadEntriesCount = storageService.getEntriesCount(null, 'unread', null);

    counter.value = unreadEntriesCount;
    panel.setAttribute('unread', unreadEntriesCount > 0); 
  },
  
  
  onBriefButtonClick: function(aEvent) {
	  // Clicking the button when Brief is open in current tab "unpresses" it and
	  // closes Brief.
    if (gBrowser.selectedTab == this.tab && aEvent.button == 0) {
      gBrowser.removeCurrentTab();
      return;
    }
    
    var openInNewTab = this.prefs.getBoolPref('openInNewTab');
    
    if ((aEvent.button == 0 && !openInNewTab) ||
        (aEvent.button == 1 && openInNewTab))
      gBrief.openBrief(false);
    
    else if ((aEvent.button == 0 && openInNewTab) ||
             (aEvent.button == 1 && !openInNewTab))
	    gBrief.openBrief(true);
	},
	
	onBriefTabLoad: function(aEvent) {
    if (this.currentURI.spec != BRIEF_URL) {
      gBrief.tab = null;
      if (gBrief.button)
        gBrief.button.checked = false;
      this.removeEventListener('load', gBrief.onBriefTabLoad, true);
    }
  },
  
  onTabClose: function(aEvent) {
    if (aEvent.originalTarget == gBrief.tab)
      gBrief.tab = null;
  },
  
  onTabSelect: function(aEvent) {
    if (gBrief.button)
      gBrief.button.checked = (aEvent.originalTarget == gBrief.tab);
  },
  
  onTabRestored: function(aEvent) {
    var restoredTab = aEvent.originalTarget;
    var browser = gBrowser.getBrowserForTab(restoredTab);
    if (browser.currentURI.spec == BRIEF_URL) {
      gBrief.tab = restoredTab;
      gBrief.button.checked = (gBrowser.selectedTab == restoredTab);
    }
  },
  
	handleEvent: function(aEvent) {
    switch (aEvent.type) {
      case 'load':
        window.removeEventListener('load', this, false);
        
        // Cache frequently used elements.
        this.button = document.getElementById('brief-button');
        this.statusIcon = document.getElementById('brief-status');
        
        this.prefs = Cc["@mozilla.org/preferences-service;1"].
                     getService(Ci.nsIPrefService).
                     getBranch("extensions.brief.").
                     QueryInterface(Ci.nsIPrefBranch2);
        this.prefs.addObserver('', this, false);
    
        var firstRun = this.prefs.getBoolPref('firstRun');
        if (firstRun)
          this.onFirstRun();    
        
        var showStatusIcon = this.prefs.getBoolPref('showStatusbarIcon');
        if (showStatusIcon) {
          this.statusIcon.hidden = false;
          this.updateStatuspanel();
        }

        // Observe changes to the feed database in order to keep the statusbar
        // icon up-to-date.
        var observerService = Cc["@mozilla.org/observer-service;1"].
                              getService(Ci.nsIObserverService);
        observerService.addObserver(this, 'brief:feed-updated', false);
        observerService.addObserver(this, 'brief:sync-to-livemarks', false);
        observerService.addObserver(this, 'brief:entry-status-changed', false);
          
        // Stores the tab in which Brief is loaded so we can ensure only 
        // instance can be open at a time. This is a UI choice, not a technical 
        // limitation.
        // These listeners are responsible for observing if and in which tab
        // Brief is loaded as well as for maintaining correct checked state
        // of the toolbarbutton.
        window.addEventListener('TabClose', this.onTabClose, false);
        window.addEventListener('TabSelect', this.onTabSelect, false);
        window.addEventListener('SSTabRestored', this.onTabRestored, false);
        window.addEventListener('unload', this, false);
        break;
      
      case 'unload':
        this.prefs.removeObserver('', this);
        var observerService = Cc["@mozilla.org/observer-service;1"].
                              getService(Ci.nsIObserverService);
        observerService.removeObserver(this, 'brief:feed-updated');
        observerService.removeObserver(this, 'brief:entry-status-changed');
        observerService.removeObserver(this, 'brief:sync-to-livemarks');
        break;
    }
  },
  
  
  onFirstRun: function() {
    // Add the toolbar button to the Navigation Bar.
    var navbar = document.getElementById("nav-bar");
    var newset = navbar.currentSet.replace('urlbar-container,',
                                           'brief-button,urlbar-container,');
    navbar.currentSet = newset;
    navbar.setAttribute("currentset", newset);
    document.persist("nav-bar", "currentset");
    
    this.prefs.setBoolPref('firstRun', false);
  },
  
  
  observe: function(aSubject, aTopic, aData) {
    switch (aTopic) {
      case 'brief:sync-to-livemarks':
        if (!this.statusIcon.hidden)
          this.updateStatuspanel();
        break;
      
      case 'brief:feed-updated':
        if (aSubject.QueryInterface(Ci.nsIVariant) > 0 &&
            !this.statusIcon.hidden)
          this.updateStatuspanel();
        break;
      
      case 'brief:entry-status-changed':
        if ((aData == 'read' || (aData == 'unread') || aData == 'deleted') && 
            !this.statusIcon.hidden)
          this.updateStatuspanel();
        break;
        
      case 'nsPref:changed':
        switch (aData) {
          case 'showStatusbarIcon':
            var newValue = this.prefs.getBoolPref('showStatusbarIcon');
            var statusIcon = document.getElementById('brief-status');
            statusIcon.hidden = !newValue;
            if (newValue)
              this.updateStatuspanel();
            break;
        }
        break;
    }
  }
  
};

window.addEventListener('load', gBrief, false);


function dump(aMessage) {
	var consoleService = Cc['@mozilla.org/consoleservice;1']
	                     .getService(Ci.nsIConsoleService);
	consoleService.logStringMessage('Brief:\n ' + aMessage);
}