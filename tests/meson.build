tests = ['addressTest', 'boundingBoxTest', 'colorTest', 'osmNamesTest',
         'placeIconsTest', 'timeTest', 'translationsTest', 'utilsTest',
         'urlsTest']

foreach test : tests
  script_conf = configuration_data()
  script_conf.set('GJS', find_program('gjs').path())
  script_conf.set('PACKAGE_VERSION', version)
  script_conf.set('libdir', libdir)
  script_conf.set('prefix', prefix)
  script_conf.set('name', test)
  configure_file(
    input: 'test.in',
    output: test,
    configuration: script_conf,
    install: false,
    install_dir: pkgdatadir
  )
endforeach

foreach test : tests
  test(test, find_program('gjs'),
       args: ['-I', meson.source_root() + '/src/', '-I',
              meson.source_root() + '/tests/',
              'tests/@0@'.format(test)],
       env:  ['LANG=C', 'LC_ALL=C']
  )
endforeach

