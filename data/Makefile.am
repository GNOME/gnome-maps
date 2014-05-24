SUBDIRS = icons

# The desktop files
desktopdir = $(datadir)/applications
desktop_DATA = \
	org.gnome.Maps.desktop
@INTLTOOL_DESKTOP_RULE@

gsettingsschema_in_files = org.gnome.maps.gschema.xml.in
gsettings_SCHEMAS = $(gsettingsschema_in_files:.xml.in=.xml)
.PRECIOUS: $(gsettings_SCHEMAS)

@INTLTOOL_XML_NOMERGE_RULE@
@GSETTINGS_RULES@

appdatadir = $(datadir)/appdata
appdata_in_file = org.gnome.Maps.appdata.xml.in
appdata_DATA = $(appdata_in_file:.xml.in=.xml)
@INTLTOOL_XML_RULE@

EXTRA_DIST= \
    $(desktop_DATA) \
    $(desktop_in_files) \
    $(appdata_in_file) \
    $(gsettingsschema_in_files)

CLEANFILES = \
    $(desktop_DATA) \
    $(appdata_DATA) \
    $(gsettings_SCHEMAS)
