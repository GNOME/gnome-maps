script_conf = configuration_data()
script_conf.set('GJS', find_program('gjs').path())
script_conf.set('PACKAGE_VERSION', version)
script_conf.set('libdir', libdir)
script_conf.set('prefix', prefix)
script_conf.set('APPLICATION_ID', app_id)
script_conf.set('profile', get_option('profile'))

configure_file(
	input: 'org.gnome.Maps.in',
	output: app_id,
	configuration: script_conf,
	install: true,
	install_dir: pkgdatadir
)

gnome.compile_resources(
	app_id + '.src',
	'org.gnome.Maps.src.gresource.xml',
	gresource_bundle: true,
	install: true,
	install_dir: pkgdatadir,
	source_dir: 'geojson-vt'
)
