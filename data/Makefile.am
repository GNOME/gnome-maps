# The desktop files
desktopdir = $(datadir)/applications
desktop_DATA = \
	gnome-maps.desktop
@INTLTOOL_DESKTOP_RULE@

gsettingsschema_in_files = org.gnome.maps.gschema.xml.in
gsettings_SCHEMAS = $(gsettingsschema_in_files:.xml.in=.xml)
.PRECIOUS: $(gsettings_SCHEMAS)

@INTLTOOL_XML_NOMERGE_RULE@
@GSETTINGS_RULES@

EXTRA_DIST= \
    gnome-maps.desktop \
    $(desktop_in_files) \
    $(gsettingsschema_in_files)

CLEANFILES = \
    $(desktop_DATA) \
    $(gsettings_SCHEMAS)
