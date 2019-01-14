install_data(
	join_paths('public', 'hicolor', 'scalable', 'apps', 'org.gnome.Maps.svg'),
	install_dir: join_paths(datadir, 'icons', 'hicolor', 'scalable', 'apps'),
	rename: '@0@.svg'.format(app_id)
)

install_data(
	join_paths('public', 'hicolor', 'symbolic', 'apps', 'org.gnome.Maps-symbolic.svg'),
	install_dir: join_paths(datadir, 'icons', 'hicolor', 'symbolic', 'apps'),
	rename: '@0@-symbolic.svg'.format(app_id)
)

install_subdir(
	join_paths('private', 'hicolor'),
	install_dir: join_paths(pkgdatadir, 'icons')
)
