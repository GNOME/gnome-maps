gnome.compile_resources(
	app_id + '.data',
	app_id + '.data.gresource.xml',
	gresource_bundle: true,
	install: true,
	install_dir: pkgdatadir
)

install_data(
	'maps-service.json',
	install_dir: pkgdatadir
)

desktop = app_id + '.desktop'

custom_target('desktop-file',
  input: desktop + '.in',
  output: desktop,
  install: true,
  install_dir: join_paths(datadir, 'applications'),
  command: [msgfmt, '--desktop',
    '--template', '@INPUT@', '-d', po_dir, '-o', '@OUTPUT@',
    '--keyword=X-Geoclue-Reason', '--keyword=Name', '--keyword=Comment',
    '--keyword=Keywords'
  ]
)

install_data(
	app_id + '.gschema.xml',
	install_dir: join_paths(datadir, 'glib-2.0', 'schemas')
)

appdata = app_id + '.appdata.xml'

i18n.merge_file(
	appdata,
	input: appdata + '.in',
	output: appdata,
	po_dir: po_dir,
	install: true,
	install_dir: join_paths(datadir, 'metainfo')
)

service_conf = configuration_data()
service_conf.set('PACKAGE_NAME', meson.project_name())
service_conf.set('pkgdatadir', pkgdatadir)

configure_file(
	input: app_id + '.service.in',
	output: app_id + '.service',
	configuration: service_conf,
	install: true,
	install_dir: join_paths(datadir, 'dbus-1', 'services')
)

subdir('icons')
