AM_CPPFLAGS = \
    -I$(top_builddir)/config \
    -I$(top_srcdir)	\
    -L$(top_srcdir)/src \
    -DGNOME_MAPS_LIBDIR=\"$(libdir)\" \
    -DGNOME_MAPS_DATADIR=\"$(datadir)\" \
    -DGNOME_MAPS_PKGDATADIR=\"$(pkgdatadir)\" \
    -DGNOME_MAPS_TOP_SRCDIR=\"$(abs_top_srcdir)\" \
    -DGNOME_MAPS_BUILDDIR=\"$(abs_top_builddir)\"

BUILT_SOURCES =
EXTRA_DIST =
CLEANFILES =

# convenience command for doing Makefile variable substitutions in non-Makefile
# files (scripts, service files, etc.)
do_subst = sed -e 's|@abs_top_srcdir[@]|$(abs_top_srcdir)|g' \
               -e 's|@abs_top_builddir[@]|$(abs_top_builddir)|g' \
               -e 's|@localedir[@]|$(localedir)|g' \
               -e 's|@bindir[@]|$(bindir)|g' \
               -e 's|@libdir[@]|$(libdir)|g' \
               -e 's|@libexecdir[@]|$(libexecdir)|g' \
               -e 's|@pkglibdir[@]|$(pkglibdir)|g' \
               -e 's|@pkgdatadir[@]|$(pkgdatadir)|g' \
               -e 's|@GJS_CONSOLE[@]|$(GJS_CONSOLE)|g' \
               -e 's|@PACKAGE_NAME[@]|$(PACKAGE_NAME)|g' \
               -e 's|@PACKAGE_VERSION[@]|$(PACKAGE_VERSION)|g' \
               -e 's|@GETTEXT_PACKAGE[@]|$(GETTEXT_PACKAGE)|g'

include $(INTROSPECTION_MAKEFILE)
include Makefile-js.am

resource_files = $(shell $(GLIB_COMPILE_RESOURCES) --sourcedir=$(srcdir) --generate-dependencies $(srcdir)/gnome-maps.gresource.xml)
gnome-maps.gresource: gnome-maps.gresource.xml $(resource_files)
	$(AM_V_GEN) $(GLIB_COMPILE_RESOURCES) --target=$@ --sourcedir=$(srcdir) $<
EXTRA_DIST += gnome-maps.gresource.xml $(resource_files)

resourcedir = $(pkgdatadir)
resource_DATA = gnome-maps.gresource

CLEANFILES += gnome-maps.gresource

bin_SCRIPTS = gnome-maps

gnome-maps: gnome-maps.in
	$(AM_V_GEN) $(do_subst) $< > $@
	chmod +x $@

CLEANFILES += \
    gnome-maps
EXTRA_DIST += \
    gnome-maps.in
