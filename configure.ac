# This file is processed by autoconf to create a configure script
AC_INIT([gnome-maps],
        [3.16.0],
        [https://bugzilla.gnome.org/enter_bug.cgi?product=gnome-maps],
        [gnome-maps])

AC_CONFIG_HEADERS([config/config.h])
AC_CONFIG_SRCDIR([src/main.js])
AC_CONFIG_MACRO_DIR([m4])
AC_CONFIG_AUX_DIR([config])
AC_PROG_LN_S

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

AC_CANONICAL_TARGET

AM_INIT_AUTOMAKE([1.10 no-define foreign dist-xz no-dist-gzip])
AM_MAINTAINER_MODE([enable])

GETTEXT_PACKAGE=AC_PACKAGE_NAME
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE,"$GETTEXT_PACKAGE",[The name of the gettext domain])
IT_PROG_INTLTOOL(0.40.0)
PKG_PROG_PKG_CONFIG([0.22])

GLIB_MKENUMS=`$PKG_CONFIG --variable=glib_mkenums glib-2.0`
AC_SUBST(GLIB_MKENUMS)

GIO_MIN_VERSION=2.39.3
GJS_MIN_VERSION=1.43.3
GOBJECT_INTROSPECTION_MIN_VERSION=0.10.1
GTK_MIN_VERSION=3.15.9
GEOCLUE_MIN_VERSION=0.12.99

PKG_CHECK_MODULES(GNOME_MAPS, [
    gio-2.0                      >= $GIO_MIN_VERSION
    gjs-1.0                      >= $GJS_MIN_VERSION
    gobject-introspection-1.0    >= $GOBJECT_INTROSPECTION_MIN_VERSION
    gtk+-3.0                     >= $GTK_MIN_VERSION
    geoclue-2.0                  >= $GEOCLUE_MIN_VERSION
])

FOLKS_MIN_VERSION=0.10.0
GEE_MIN_VERSION=0.16.0
GEOCODE_MIN_VERSION=3.15.2
CHAMPLAIN_MIN_VERSION=0.12.9

PKG_CHECK_MODULES(GNOME_MAPS_LIB, [
    gee-0.8                      >= $GEE_MIN_VERSION
    folks                        >= $FOLKS_MIN_VERSION
    geocode-glib-1.0             >= $GEOCODE_MIN_VERSION
    champlain-0.12               >= $CHAMPLAIN_MIN_VERSION
])
AC_SUBST(GNOME_MAPS_LIB_CFLAGS)
AC_SUBST(GNOME_MAPS_LIB_LIBS)

AC_PROG_LIBTOOL

GLIB_GSETTINGS

AC_PATH_PROG([GJS],[gjs])

GLIB_COMPILE_RESOURCES=`$PKG_CONFIG --variable glib_compile_resources gio-2.0`
AC_SUBST(GLIB_COMPILE_RESOURCES)

GOBJECT_INTROSPECTION_CHECK([0.6.3])

AC_CONFIG_FILES([
    Makefile
    lib/Makefile
    src/Makefile
    data/Makefile
    data/icons/Makefile
    po/Makefile.in
])
AC_OUTPUT
