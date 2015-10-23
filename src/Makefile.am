NULL =

appdir = $(pkgdatadir)
nodist_app_SCRIPTS = org.gnome.Maps

app_resource_files =							\
	$(shell $(GLIB_COMPILE_RESOURCES)				\
		--sourcedir=$(srcdir)					\
		--sourcedir=$(srcdir)/geojson-vt			\
		--generate-dependencies					\
		$(srcdir)/org.gnome.Maps.src.gresource.xml		\
	)

org.gnome.Maps.src.gresource: org.gnome.Maps.src.gresource.xml $(app_resource_files)
	$(AM_V_GEN) $(GLIB_COMPILE_RESOURCES)				\
		--target=$@						\
		--sourcedir=$(srcdir)/geojson-vt			\
		--sourcedir=$(srcdir) $<

resourcedir = $(pkgdatadir)
resource_DATA = org.gnome.Maps.src.gresource

org.gnome.Maps: org.gnome.Maps.in
	$(AM_V_GEN) sed							\
		-e "s|[@]GJS@|$(GJS)|g"					\
		-e "s|[@]PACKAGE_VERSION@|$(PACKAGE_VERSION)|g"		\
		-e "s|[@]prefix@|$(prefix)|g"				\
		-e "s|[@]libdir@|$(libdir)|g"				\
		-e "s|[@]pkgdatadir@|$(pkgdatadir)|g"			\
		$< > $@
	@chmod +x $@

EXTRA_DIST =								\
	org.gnome.Maps.in						\
	org.gnome.Maps.src.gresource.xml				\
	geojson-vt/LICENSE						\
	$(app_resource_files)						\
	$(service_resource_files)					\
	$(NULL)

CLEANFILES =								\
	org.gnome.Maps							\
	org.gnome.Maps.src.gresource					\
	$(NULL)

install-exec-hook:
	$(MKDIR_P) $(DESTDIR)$(bindir)
	-rm -f $(DESTDIR)$(bindir)/gnome-maps
	$(LN_S) $(appdir)/org.gnome.Maps $(DESTDIR)$(bindir)/gnome-maps
uninstall-hook:
	-rm -f $(DESTDIR)$(bindir)/gnome-maps

-include $(top_srcdir)/git.mk
