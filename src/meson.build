script_conf = configuration_data()
script_conf.set('GJS', gjs.path())
script_conf.set('PACKAGE_VERSION', version)
script_conf.set('libdir', libdir)
script_conf.set('prefix', prefix)

configure_file(
	input: app_id + '.in',
	output: app_id,
	configuration: script_conf,
	install: true,
	install_dir: pkgdatadir
)

gnome.compile_resources(
	app_id + '.src',
	app_id + '.src.gresource.xml',
	gresource_bundle: true,
	install: true,
	install_dir: pkgdatadir,
	source_dir: 'geojson-vt'
)
