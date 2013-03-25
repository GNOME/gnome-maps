# This file is processed by autoconf to create a configure script
AC_INIT([gnome-maps],
        [3.7.2],
        [https://bugzilla.gnome.org/enter_bug.cgi?product=gnome-maps],
        [gnome-maps])

AC_CONFIG_HEADERS([config/config.h])
AC_CONFIG_SRCDIR([src/main.js])
AC_CONFIG_MACRO_DIR([m4])
AC_CONFIG_AUX_DIR([config])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

AC_CANONICAL_TARGET

AM_INIT_AUTOMAKE([1.10 no-define foreign dist-xz no-dist-gzip])
AM_MAINTAINER_MODE([enable])

GETTEXT_PACKAGE=AC_PACKAGE_NAME
AC_SUBST(GETTEXT_PACKAGE)
AC_DEFINE_UNQUOTED(GETTEXT_PACKAGE,"$GETTEXT_PACKAGE",[The name of the gettext domain])
IT_PROG_INTLTOOL(0.40.0)
PKG_PROG_PKG_CONFIG([0.22])

AM_GNU_GETTEXT([external])
AM_GNU_GETTEXT_VERSION([0.17])

# no stupid static libraries
AM_DISABLE_STATIC
# enable libtool
AC_PROG_LIBTOOL
# avoid libtool for LTCOMPILE, use it only to link

GLIB_GSETTINGS

GJS_CONSOLE=`$PKG_CONFIG --variable=gjs_console gjs-1.0`
AC_SUBST(GJS_CONSOLE)

GLIB_COMPILE_RESOURCES=`$PKG_CONFIG --variable glib_compile_resources gio-2.0`
AC_SUBST(GLIB_COMPILE_RESOURCES)

LIBGD_INIT([
  header-bar
  tagged-entry
  gir
])

AC_CONFIG_FILES([
    Makefile
    libgd/Makefile
    src/Makefile
    data/Makefile
    data/gnome-maps.desktop.in
    data/icons/Makefile
    po/Makefile.in
])
AC_OUTPUT
