NULL =

public_icons_themes =							\
	hicolor								\
	$(NULL)

public_icons =								\
	hicolor_apps_16x16_org.gnome.Maps.png				\
	hicolor_apps_22x22_org.gnome.Maps.png				\
	hicolor_apps_24x24_org.gnome.Maps.png				\
	hicolor_apps_32x32_org.gnome.Maps.png				\
	hicolor_apps_48x48_org.gnome.Maps.png				\
	hicolor_apps_256x256_org.gnome.Maps.png			\
	hicolor_apps_symbolic_org.gnome.Maps-symbolic.svg		\
	$(NULL)

private_icons =								\
	hicolor_apps_16x16_maps-point-start.svg				\
	hicolor_apps_16x16_maps-point-end.svg				\
	hicolor_apps_16x16_maps-point-start-symbolic.svg		\
	hicolor_apps_16x16_maps-point-end-symbolic.svg			\
	hicolor_apps_32x32_maps-direction-sharpleft-symbolic.svg	\
	hicolor_apps_32x32_maps-direction-left-symbolic.svg		\
	hicolor_apps_32x32_maps-direction-slightleft-symbolic.svg	\
	hicolor_apps_32x32_maps-direction-continue-symbolic.svg		\
	hicolor_apps_32x32_maps-direction-slightright-symbolic.svg	\
	hicolor_apps_32x32_maps-direction-right-symbolic.svg		\
	hicolor_apps_32x32_maps-direction-roundabout-symbolic.svg	\
	hicolor_apps_32x32_maps-direction-roundabout-0-symbolic.svg	\
	hicolor_apps_32x32_maps-direction-roundabout-45-symbolic.svg    \
	hicolor_apps_32x32_maps-direction-roundabout-90-symbolic.svg    \
	hicolor_apps_32x32_maps-direction-roundabout-135-symbolic.svg   \
	hicolor_apps_32x32_maps-direction-roundabout-180-symbolic.svg   \
	hicolor_apps_32x32_maps-direction-roundabout-225-symbolic.svg   \
	hicolor_apps_32x32_maps-direction-roundabout-270-symbolic.svg   \
	hicolor_apps_32x32_maps-direction-roundabout-315-symbolic.svg	\
	hicolor_apps_32x32_maps-direction-sharpright-symbolic.svg	\
	hicolor_apps_16x16_layer-visible-symbolic.svg			\
	hicolor_apps_16x16_layer-not-visible-symbolic.svg		\
	hicolor_apps_16x16_layers-button-symbolic.svg			\
	hicolor_apps_16x16_route-button-symbolic.svg			\
	hicolor_apps_16x16_route-pedestrian-symbolic.svg 		\
	hicolor_apps_16x16_route-transit-symbolic.svg 			\
	hicolor_apps_16x16_route-bike-symbolic.svg 			\
	hicolor_apps_16x16_route-car-symbolic.svg 			\
	hicolor_apps_16x16_route-transit-bus-symbolic.svg		\
	hicolor_apps_16x16_route-transit-cablecar-symbolic.svg		\
	hicolor_apps_16x16_route-transit-ferry-symbolic.svg		\
	hicolor_apps_16x16_route-transit-funicular-symbolic.svg		\
	hicolor_apps_16x16_route-transit-gondolalift-symbolic.svg	\
	hicolor_apps_16x16_route-transit-subway-symbolic.svg		\
	hicolor_apps_16x16_route-transit-train-symbolic.svg		\
	hicolor_apps_16x16_route-transit-tram-symbolic.svg		\
	hicolor_apps_24x24_user-location.png				\
	hicolor_apps_24x24_user-location-compass.png			\
	$(NULL)

noinst_DATA =								\
	org.gnome.Maps.svg						\
	hicolor_apps_24x24_user-location.svg				\
	hicolor_apps_24x24_user-location-compass.svg			\
	$(NULL)

EXTRA_DIST =								\
	$(public_icons)							\
	$(private_icons)						\
	org.gnome.Maps.svg						\
	hicolor_apps_24x24_user-location.svg				\
	hicolor_apps_24x24_user-location-compass.svg			\
	$(NULL)

###############################################################################

gtk_update_icon_cache = gtk-update-icon-cache -f -t

update-icon-cache:
	@-if test -z "$(DESTDIR)"; then \
		echo "Updating Gtk icon cache."; \
		for theme in $(public_icons_themes); do \
			$(gtk_update_icon_cache) $(datadir)/icons/$$theme; \
		done; \
	else \
		echo "*** Icon cache not updated.  After (un)install, run this:"; \
		for theme in $(public_icons_themes); do \
			echo "***   $(gtk_update_icon_cache) $(datadir)/icons/$$theme"; \
		done; \
	fi

install-icons:
	for icon in $(public_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		mkdir -p $(DESTDIR)$(datadir)/icons/$$THEME/$$SIZE/$$CONTEXT; \
		$(INSTALL_DATA) $(srcdir)/$$icon $(DESTDIR)$(datadir)/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done
	for icon in $(private_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		mkdir -p $(DESTDIR)$(datadir)/gnome-maps/icons/$$THEME/$$SIZE/$$CONTEXT; \
		$(INSTALL_DATA) $(srcdir)/$$icon $(DESTDIR)$(datadir)/gnome-maps/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done

uninstall-icons:
	-for icon in $(public_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		rm -f $(DESTDIR)$(datadir)/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done
	-for icon in $(private_icons); do \
		THEME=`echo $$icon | cut -d_ -f1`; \
		CONTEXT=`echo $$icon | cut -d_ -f2`; \
		SIZE=`echo $$icon | cut -d_ -f3`; \
		ICONFILE=`echo $$icon | cut -d_ -f4`; \
		rm -f $(DESTDIR)$(datadir)/gnome-maps/icons/$$THEME/$$SIZE/$$CONTEXT/$$ICONFILE; \
	done

install-data-local: install-icons
install-data-hook: update-icon-cache

uninstall-local: uninstall-icons
uninstall-hook: update-icon-cache

-include $(top_srcdir)/git.mk
