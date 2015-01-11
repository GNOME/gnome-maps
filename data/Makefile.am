SUBDIRS = icons

app_resource_files =							\
	$(shell $(GLIB_COMPILE_RESOURCES)				\
		--sourcedir=$(srcdir)					\
		--generate-dependencies					\
		$(srcdir)/org.gnome.Maps.data.gresource.xml			\
	)
org.gnome.Maps.data.gresource: org.gnome.Maps.data.gresource.xml $(app_resource_files)
	$(AM_V_GEN) $(GLIB_COMPILE_RESOURCES)				\
		--target=$@						\
		--sourcedir=$(srcdir) $<

resourcedir = $(pkgdatadir)
resource_DATA = org.gnome.Maps.data.gresource

appsdir = $(datadir)/applications
apps_DATA = org.gnome.Maps.desktop

@INTLTOOL_DESKTOP_RULE@

gsettings_SCHEMAS = org.gnome.Maps.gschema.xml

@INTLTOOL_XML_RULE@
@GSETTINGS_RULES@

appdatadir = $(datadir)/appdata
appdata_in_file = org.gnome.Maps.appdata.xml.in
appdata_DATA = $(appdata_in_file:.xml.in=.xml)
@INTLTOOL_XML_RULE@

org.gnome.Maps.service: org.gnome.Maps.service.in
	$(AM_V_GEN) sed \
		-e "s|[@]pkgdatadir@|$(pkgdatadir)|g"			\
		-e "s|[@]pkglibdir@|$(pkglibdir)|g"			\
		$< > $@

servicedir = $(datadir)/dbus-1/services
service_DATA = org.gnome.Maps.service

EXTRA_DIST =								\
	org.gnome.Maps.desktop.in					\
	org.gnome.Maps.service.in					\
	org.gnome.Maps.data.gresource.xml				\
	org.gnome.Maps.appdata.xml.in					\
	org.gnome.Maps.gschema.xml.in					\
	$(app_resource_files)						\
	$(NULL)

CLEANFILES =								\
	org.gnome.Maps.service						\
	org.gnome.Maps.data.gresource					\
	org.gnome.Maps.appdata.xml					\
	org.gnome.Maps.appdata.valid					\
	$(apps_DATA)							\
	org.gnome.Maps.gschema.xml					\
	org.gnome.Maps.gschema.valid					\
	gschemas.compiled						\
	$(gsettings_SCHEMAS)						\
	$(NULL)

# For uninstalled use
all-local:
	$(GLIB_COMPILE_SCHEMAS) $(builddir)

-include $(top_srcdir)/git.mk
