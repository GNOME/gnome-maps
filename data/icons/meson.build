# install the app icon (the regular or .Devel one)
install_data(
	join_paths('public', 'hicolor', 'scalable', 'apps', app_id + '.svg'),
	install_dir: join_paths(datadir, 'icons', 'hicolor', 'scalable', 'apps')
)

# install the symbolic app icon with the current name (optionally with .Devel suffix)
install_data(
	join_paths('public', 'hicolor', 'symbolic', 'apps', 'org.gnome.Maps-symbolic.svg'),
	install_dir: join_paths(datadir, 'icons', 'hicolor', 'symbolic', 'apps'),
	rename: '@0@-symbolic.svg'.format(app_id)
)

install_subdir(
	join_paths('private', 'hicolor'),
	install_dir: join_paths(pkgdatadir, 'icons')
)

install_subdir(
	join_paths('stations', 'hicolor'),
	install_dir: join_paths(pkgdatadir, 'icons')
)
