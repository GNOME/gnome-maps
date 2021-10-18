#!/usr/bin/env python3

import glob
import os
import re
import subprocess
import sys

datadir = sys.argv[1]

destdir = os.environ.get('DESTDIR', '')
bindir = os.path.normpath(destdir + os.sep + sys.argv[2])

appid = sys.argv[3];

# FIXME: meson will not track the creation of these files
#        https://github.com/mesonbuild/meson/blob/master/mesonbuild/scripts/uninstall.py#L39
if not os.path.exists(bindir):
  os.makedirs(bindir)

src = os.path.join(datadir, 'gnome-maps', appid)
dest = os.path.join(bindir, 'gnome-maps')
subprocess.call(['ln', '-s', '-f', src, dest])

if not os.environ.get('DESTDIR'):
  icondir = os.path.join(datadir, 'icons', 'hicolor')

  print('Update icon cache...')
  subprocess.call(['gtk-update-icon-cache', '-f', '-t', icondir])

  schemadir = os.path.join(datadir, 'glib-2.0', 'schemas')
  print('Compiling gsettings schemas...')
  subprocess.call(['glib-compile-schemas', schemadir])

  # FIXME
  '''
  search_pattern = '/*.desktop'

  desktopdir = os.path.join(datadir, 'applications')
  print('Validate desktop files...')
  [subprocess.call(['desktop-file-validate', file])
   for file in glob.glob(desktopdir + search_pattern, recursive=False)]
  '''

