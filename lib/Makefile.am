pkglib_LTLIBRARIES = libgnome-maps.la

BUILT_SOURCES =							\
	maps-enum-types.c						\
	maps-enum-types.h

libgnome_maps_headers_private = maps-contact-store.h maps-contact.h maps.h
libgnome_maps_sources = maps-contact-store.c maps-contact.c
libgnome_maps_la_SOURCES =						\
	$(libgnome_maps_sources)					\
	$(libgnome_maps_headers_private)				\
	$(BUILT_SOURCES)

libgnome_maps_la_LIBADD = $(GNOME_MAPS_LIB_LIBS)
libgnome_maps_la_LDFLAGS =						\
	-avoid-version

AM_CPPFLAGS =								\
	$(GNOME_MAPS_LIB_CFLAGS)					\
	-I$(top_srcdir)

maps-enum-types.h: $(libgnome_maps_headers_private)
	$(AM_V_GEN) ($(GLIB_MKENUMS)					\
		--template $(srcdir)/maps-enum-types.h.template			\
		$^ > xgen-$(@F) && mv -f xgen-$(@F) $@)

maps-enum-types.c: $(libgnome_maps_headers_private) maps-enum-types.h
	$(AM_V_GEN) ($(GLIB_MKENUMS)					\
		--template $(srcdir)/maps-enum-types.c.template			\
		$^ > xgen-$(@F) && mv -f xgen-$(@F) $@)

if HAVE_INTROSPECTION
-include $(INTROSPECTION_MAKEFILE)
INTROSPECTION_SCANNER_ARGS = --warn-all

GnomeMaps-1.0.gir: libgnome-maps.la
GnomeMaps_1_0_gir_INCLUDES =						\
	GLib-2.0							\
	GObject-2.0							\
	GeocodeGlib-1.0						\
	Champlain-0.12
GnomeMaps_1_0_gir_PACKAGES = gobject-2.0 geocode-glib-1.0
GnomeMaps_1_0_gir_FILES = $(libgnome_maps_la_SOURCES)
GnomeMaps_1_0_gir_CFLAGS = $(MAPS_CFLAGS) -I$(top_srcdir) -I$(top_builddir) -I$(srcdir)
GnomeMaps_1_0_gir_LIBS = libgnome-maps.la
GnomeMaps_1_0_gir_EXPORT_PACKAGES = gnome-maps-1.0
GnomeMaps_1_0_gir_SCANNERFLAGS =					\
	--symbol-prefix=maps						\
	--identifier-prefix=Maps
INTROSPECTION_GIRS = GnomeMaps-1.0.gir

girdir = $(datadir)/gir-1.0
gir_DATA = $(INTROSPECTION_GIRS)

typelibdir = $(pkglibdir)/girepository-1.0
typelib_DATA = $(INTROSPECTION_GIRS:.gir=.typelib)

CLEANFILES = $(gir_DATA) $(typelib_DATA) $(BUILT_SOURCES)
endif
