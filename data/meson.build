data_conf = configuration_data()
if (get_option('profile') == 'development')
	data_conf.set('suffix', '/Devel')
else
	data_conf.set('suffix', '')
endif
gnome.compile_resources(
	app_id + '.data',
	configure_file(
		input: 'org.gnome.Maps.data.gresource.xml.in',
		output: 'org.gnome.Maps.data.gresource.xml',
		configuration: data_conf
	),
	gresource_bundle: true,
	install: true,
	install_dir: pkgdatadir
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

appdata = app_id + '.appdata.xml'
appdata_config = configuration_data()
appdata_config.set('app-id', app_id)
appdata_config.set('gettext-package', 'gnome-maps')
appdata_file = i18n.merge_file(
	input: configure_file(
		input: 'org.gnome.Maps.appdata.xml.in.in',
		output: 'org.gnome.Maps.appdata.xml.in',
		configuration: appdata_config
	),
	output: appdata,
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

if desktop_file_validate.found()
	test(
		'validate-desktop',
		desktop_file_validate,
		args: [
			desktop_file.full_path()
		]
	)
endif

if appstream_util.found()
	test(
		'validate-appdata',
		appstream_util,
		args: [
			'validate-relax',
			'--nonet',
			appdata_file.full_path()
		]
	)
endif

subdir('icons')
