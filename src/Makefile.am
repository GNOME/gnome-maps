BUILT_SOURCES =
EXTRA_DIST =
CLEANFILES =

# convenience command for doing Makefile variable substitutions in non-Makefile
# files (scripts, service files, etc.)
do_subst = sed  -e 's|@abs_top_srcdir[@]|$(abs_top_srcdir)|g'		\
		-e 's|@abs_top_builddir[@]|$(abs_top_builddir)|g'	\
		-e 's|@localedir[@]|$(localedir)|g'			\
		-e 's|@bindir[@]|$(bindir)|g'				\
		-e 's|@libdir[@]|$(libdir)|g'				\
		-e 's|@libexecdir[@]|$(libexecdir)|g'			\
		-e 's|@pkglibdir[@]|$(pkglibdir)|g'			\
		-e 's|@pkgdatadir[@]|$(pkgdatadir)|g'			\
		-e 's|@GJS_CONSOLE[@]|$(GJS_CONSOLE)|g'			\
		-e 's|@PACKAGE_NAME[@]|$(PACKAGE_NAME)|g'		\
		-e 's|@PACKAGE_VERSION[@]|$(PACKAGE_VERSION)|g'		\
		-e 's|@GETTEXT_PACKAGE[@]|$(GETTEXT_PACKAGE)|g'

include $(INTROSPECTION_MAKEFILE)
include Makefile-js.am

data_files = $(shell $(GLIB_COMPILE_RESOURCES)				\
		--sourcedir=$(srcdir)					\
		--generate-dependencies $(srcdir)/gnome-maps.data.gresource.xml)

dbusservicedir = $(datadir)/dbus-1/services
dbusservice_DATA = org.gnome.Maps.service

org.gnome.Maps.service: Makefile
		$(AM_V_GEN) (echo '[D-BUS Service]'; \
		echo 'Name=org.gnome.Maps'; \
		echo 'Exec=${bindir}/gnome-maps --gapplication-service') > $@.tmp && \
		mv $@.tmp $@

gnome-maps-data.h: gnome-maps.data.gresource.xml $(data_files)
	$(AM_V_GEN)							\
		$(GLIB_COMPILE_RESOURCES)				\
		--target=$@						\
		--sourcedir=$(srcdir)					\
		--sourcedir=$(builddir)					\
		--generate						\
		--c-name gnome_maps_data $<
gnome-maps-data.c: gnome-maps.data.gresource.xml $(data_files)
	$(AM_V_GEN)							\
		$(GLIB_COMPILE_RESOURCES)				\
		--target=$@						\
		--sourcedir=$(srcdir)					\
		--sourcedir=$(builddir)					\
		--generate						\
		--c-name gnome_maps_data $<

EXTRA_DIST += gnome-maps.data.gresource.xml $(data_files)

data_built_sources = gnome-maps-data.c gnome-maps-data.h

BUILT_SOURCES += $(data_built_sources)

bin_PROGRAMS = gnome-maps

CLEANFILES +=								\
	gnome-maps							\
	$(dbusservice_DATA)						\
	$(data_built_sources)

gnome_maps_SOURCES = main.c						\
	$(NULL)
nodist_gnome_maps_SOURCES =						\
	$(top_builddir)/src/gnome-maps-data.c				\
	$(top_builddir)/src/gnome-maps-data.h				\
	$(top_builddir)/src/gnome-maps-js.c				\
	$(top_builddir)/src/gnome-maps-js.h				\
	$(NULL)

gnome_maps_CPPFLAGS =							\
	$(GNOME_MAPS_CFLAGS)						\
	-DLOCALEDIR=\"$(localedir)\"					\
	-DGNOME_MAPS_PKGLIBDIR=\"$(pkglibdir)\"
gnome_maps_LDADD =							\
	$(GNOME_MAPS_LIBS)
