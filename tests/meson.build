tests = ['addressTest', 'boundingBoxTest', 'colorTest', 'epafTest', 'osmNamesTest',
         'placeIconsTest', 'placeStoreTest', 'placeZoomTest', 'timeTest', 'translationsTest',
         'utilsTest', 'urisTest', 'wikipediaTest']

# suffix for source resources (so we get /org/gnome/Maps or
# /org/gnome/Maps/Devel, depending on the profile)
if (get_option('profile') == 'development')
	suffix = '/Devel'
else
	suffix = ''
endif

foreach test : tests
  script_conf = configuration_data()
  script_conf.set('GJS', gjs.full_path())
  script_conf.set('PACKAGE_VERSION', version)
  script_conf.set('libdir', libdir)
  script_conf.set('prefix', prefix)
  script_conf.set('name', test)
  script_conf.set('suffix', suffix)
  configure_file(
    input: 'test.in',
    output: test,
    configuration: script_conf,
    install: false,
    install_dir: pkgdatadir
  )
endforeach

test_gresource = gnome.compile_resources(
  app_id + '.test',
  configure_file(
    input: 'org.gnome.Maps.test.gresource.xml.in',
    output: 'test.src.gresource.xml',
    configuration: {
      'suffix': suffix,
    }
  ),
  gresource_bundle: true,
  install: false,
  install_dir: meson.project_build_root(),
)

test_wrapper = configure_file(
  input: 'test-wrapper.sh.in',
  output: 'test-wrapper.sh',
  configuration: {
    'GJS': gjs.full_path(),
    'LIBMAPS_DIR': fs.parent(libmaps_typelib.full_path()),
  },
)

foreach test : tests
  test(test, test_wrapper,
       args: ['tests/@0@'.format(test),
              src_gresource,
              data_gresource,
              test_gresource],
       env:  ['LANG=en_US.utf8', 'LC_ALL=en_US.utf8']
  )
endforeach

