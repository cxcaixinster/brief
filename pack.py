#!/bin/python
# Create xpi file from source code in src folder.

import zipfile
import os

source_dir = "src"

unused_locales = ["bg-BG", "es-AR", "hr-HR"]

def is_unused(path):
	for locale in unused_locales:
		if path.find(locale) != -1:
			return True
	return False

def get_version_number():
	content = open(source_dir + os.sep + "install.rdf").read()
	ix1 = content.find('<version>')
	ix2 = content.find('</version>')
	return content[ix1 + len('<version>') : ix2]

if __name__ == '__main__':
	xpi = 'brief-' + get_version_number() + '.xpi'
	myzip = zipfile.ZipFile(xpi, "w")
	for root, dirs, files in os.walk(source_dir):
		for name in files:
			path = os.path.join(root, name)
			if not is_unused(path):
				myzip.write(path, path[len("src"):], zipfile.ZIP_DEFLATED)

	myzip.close()

