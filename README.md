
# GNOME Maps

[![Pipeline status](https://gitlab.gnome.org/GNOME/gnome-maps/badges/master/build.svg)](https://gitlab.gnome.org/GNOME/gnome-maps/commits/master)
[![Code coverage](https://gitlab.gnome.org/GNOME/gnome-maps/badges/master/coverage.svg)](https://gitlab.gnome.org/GNOME/gnome-maps/commits/master)

This is [Maps](https://wiki.gnome.org/Apps/Maps), a map application for GNOME.

## Hacking on Maps

To build the development version of Maps and hack on the code
see the [general guide](https://wiki.gnome.org/Newcomers/BuildProject)
for building GNOME apps.

### Build Dependencies

Ubuntu: `sudo apt install libgjs-dev libgee-0.8-dev libfolks-dev libgeocode-glib-dev libchamplain-0.12-dev librest-dev`

### Meson build

* `mkdir _build`
* `cd _build`
* `meson ..`
* `ninja`
* `sudo ninja install`

## How to report issues

Report issues to the GNOME [issue tracking system](https://gitlab.gnome.org/GNOME/gnome-maps/issues).
