gnome.compile_resources(
	app_id + '.data',
	'org.gnome.Maps.data.gresource.xml',
	gresource_bundle: true,
	install: true,
	install_dir: pkgdatadir
)

install_data(
	'maps-service.json',
	install_dir: pkgdatadir
)

desktop = 'org.gnome.Maps.desktop'
desktop_config = configuration_data()
desktop_config.set('app-id', app_id)
custom_target('desktop-file',
  input: configure_file(
	  input: desktop + '.in.in',
	  output: desktop + '.in',
	  configuration: desktop_config
  ),
  output: desktop,
  install: true,
  install_dir: join_paths(datadir, 'applications'),
  command: [msgfmt, '--desktop',
    '--template', '@INPUT@', '-d', po_dir, '-o', '@OUTPUT@',
    '--keyword=X-Geoclue-Reason', '--keyword=Name', '--keyword=Comment',
    '--keyword=Keywords'
  ]
)

gschema_config = configuration_data()
gschema_config.set('schema-id', app_id)
gschema_config.set('gettext-package', gettext_package)
gschema_config.set('schema-path', schema_path)
configure_file(
	input: 'org.gnome.Maps.gschema.xml.in',
	output: '@0@.gschema.xml'.format(app_id),
	configuration: gschema_config,
	install: true,
	install_dir: join_paths(datadir, 'glib-2.0', 'schemas')
)


appdata = 'org.gnome.Maps.appdata.xml'
appdata_config = configuration_data()
appdata_config.set('app-id', app_id)
appdata_config.set('gettext-package', gettext_package)
i18n.merge_file(
	appdata,
	input: configure_file(
		input: appdata + '.in.in',
		output: appdata + '.in',
		configuration: appdata_config
	),
	output: '@0@.appdata.xml'.format(app_id),
	po_dir: po_dir,
	install: true,
	install_dir: join_paths(datadir, 'metainfo')
)

service_conf = configuration_data()
service_conf.set('PACKAGE_NAME', meson.project_name())
service_conf.set('pkgdatadir', pkgdatadir)
service_conf.set('app-id', app_id)

configure_file(
	input: 'org.gnome.Maps.service.in',
	output: app_id + '.service',
	configuration: service_conf,
	install: true,
	install_dir: join_paths(datadir, 'dbus-1', 'services')
)

subdir('icons')
