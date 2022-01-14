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

desktop_file = custom_target('desktop-file',
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

appdata_file = i18n.merge_file(
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

desktop_file_validate = find_program('desktop-file-validate', required: false)
if desktop_file_validate.found()
	test(
		'validate-desktop',
		desktop_file_validate,
		args: [
			desktop_file.full_path()
		]
	)
endif

appstream_util = find_program('appstream-util', required: false)
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
