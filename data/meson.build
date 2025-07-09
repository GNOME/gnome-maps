appdata = app_id + '.appdata.xml'
appdata_config = configuration_data()
appdata_config.set('app-id', app_id)
appdata_config.set('gettext-package', 'gnome-maps')
appdata_config.set('release-version', meson.project_version())
appdata_file = i18n.merge_file(
	input: configure_file(
		input: 'org.gnome.Maps.appdata.xml.in.in',
		output: app_id + '.appdata.xml.in',
		configuration: appdata_config
	),
	output: appdata,
	po_dir: po_dir,
	install: true,
	install_dir: join_paths(datadir, 'metainfo'),
)

data_gresource_config = configuration_data()
data_gresource_config.set('app-id',app_id)
data_gresource = gnome.compile_resources(
	app_id + '.data',
	configure_file(
		input: 'org.gnome.Maps.data.gresource.xml.in',
		output: 'org.gnome.Maps.data.gresource.xml',
		configuration: data_gresource_config
	),
	gresource_bundle: true,
	install: true,
	install_dir: pkgdatadir,
	dependencies: [appdata_file]
)

install_data(
	'maps-service.json',
	install_dir: pkgdatadir
)

desktop = app_id + '.desktop'
desktop_config = configuration_data()
desktop_config.set('app-id', app_id)
desktop_file = custom_target('desktop-file',
  input: configure_file(
  	input: 'org.gnome.Maps.desktop.in.in',
  	output: 'org.gnome.Maps.desktop.in',
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

install_data(
	'org.gnome.Maps.gschema.xml',
	install_dir: join_paths(datadir, 'glib-2.0', 'schemas')
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

if desktop_file_validate.found()
	test(
		'validate-desktop',
		desktop_file_validate,
		args: [
			desktop_file.full_path()
		]
	)
endif

if appstreamcli.found()
	test(
		'validate-appdata',
		appstreamcli,
		args: [
			'validate',
			'--no-net',
			'--override=release-time-missing=info',
			appdata_file.full_path()
		]
	)
endif

subdir('icons')
subdir('shields')
