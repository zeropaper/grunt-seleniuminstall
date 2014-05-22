/* jshint node: true */
'use strict';

var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');
var _ = require('underscore');
var seleniumJarNameExp = /selenium-server-standalone/;

var task = module.exports = function(grunt) {

  // function standaloneSeleniumJar() {
  //   var installDir = 'selenium';
  //   if (!fs.existsSync(installDir)) {
  //     return false;
  //   }
  //   var filename = _.find(fs.readdirSync(installDir), function(filename) {
  //     return seleniumJarNameExp.test(filename);
  //   });
  //   return path.join(installDir, filename);
  // }

  /**
    Downloads a file located at `downloadURL` using HTTP
    and saves it in the `directory`.
   */
  function download(downloadURL, directory, done) {
    var destination = path.join(directory, path.basename(downloadURL));
    fs.exists(destination, function(yepNope) {
      if (yepNope) {
        return done();
      }

      var file = fs.createWriteStream(destination);
      require('http').get(downloadURL, function(res) {
        res.pipe(file);
        file.on('finish', function() {
          file.close(done);
        });
      });
    });
  }

  /**
    Will download `http://bla-bla-bla.com/folder/file.zip`
    to `<directory>/file.zip` and extract its content in
    `directory`
   */
  function downloadAndExtract(downloadURL, directory, done) {
    var downloadedPath = path.join(directory, path.basename(downloadURL));

    download(downloadURL, directory, function(err) {
      if (err) {
        return done(err);
      }

      var extractor = require('unzip').Extract({
        path: directory
      });

      extractor.on('error', function(err) {
        done(err);
      });

      extractor.on('close', function() {
        console.info(downloadURL +' has been downloaded and extracted to '+ directory);
        done();
      });

      fs.createReadStream(downloadedPath).pipe(extractor);
    });
  }

  function winInstall(setup, done) {

    console.info('nixInstall setup', setup);

    return require('async').series([
      // make the "selenium" directory
      function(cb) {
        grunt.log.writeln('making selenium directory');
        fs.mkdir(setup.installDir, function(err) {
          if (err && err.errno !== 47) {
            grunt.log.warn('error while creating the install directory for selenium at '+ setup.installDir, err);
            return cb(err);
          }
          cb();
        });
      },

      // download the selenium standalone .jar file
      function(cb) {
        grunt.log.writeln('download selenium standalone');
        download(setup.downloads.selenium, setup.installDir, cb);
      },

      // download and extract the chrome driver zip file
      function(cb) {
        if (setup.downloads.chromeDriver) {
          grunt.log.writeln('download chrome webdriver');
          downloadAndExtract(setup.downloads.chromeDriver, setup.installDir, cb);
        }
        else {
          cb();
        }
      },

      // download and extract the IE driver zip file
      function(cb) {
        if (setup.downloads.ieDriver) {
          grunt.log.writeln('download IE webdriver');
          downloadAndExtract(setup.downloads.ieDriver, setup.installDir, cb);
        }
        else {
          cb();
        }
      }
    ], function(err) {
      if (err) {
        console.info('error while downloading', err.stack);
      }
      else {
        grunt.log.writeln('everything was downloaded');
      }
      done(err);
    });
  }

  function nixInstall(setup, done) {
    var stdout = '';
    var stderr = '';

    console.info('nixInstall setup', setup);

    var args = [
      'update',
      '--out_dir',
      setup.installDir
    ];

    grunt.log.writeln('selenium-install runs: '+ setup.managerPath +' '+ args.join(' '));

    var install = spawn(setup.managerPath, args);

    install.stdout.on('data', function(data) { stdout += data; });
    install.stderr.on('data', function(data) { stderr += data; });

    install.on('exit', function (code) {
      if (code) {
        grunt.log.warn('selenium standalone server installation failed:\nstdout:\n'+ stdout +'\nstderr:\n'+ stderr);
        return done(new Error('selenium-install exit with code: '+ code));
      }

      grunt.log.writeln('selenium standalone server installed');
      done();
    });
  }

  /**
    Download selenium standalone
   */
  grunt.registerTask('seleniuminstall', 'Automate the selenium webdriver installation', function() {
    var done = this.async();
    var setup = {};

    console.info('selenium-install config', arguments, this.options(), Object.keys(this));

    _.defaults(setup, {
      managerPath:  path.resolve(__dirname, '../node_modules/protractor/bin/webdriver-manager'),
      installDir:   'selenium',
      downloads:    {}
    });


    if (process.platform === 'win32') {
      _.defaults(setup.downloads, {
        selenium:     'http://selenium-release.storage.googleapis.com/2.40/selenium-server-standalone-2.40.0.jar',
        ieDriver:     'http://selenium-release.storage.googleapis.com/2.40/IEDriverServer_Win32_2.40.0.zip',
        chromeDriver: 'http://chromedriver.storage.googleapis.com/2.9/chromedriver_win32.zip'
      });

      return winInstall(setup, done);
    }


    return nixInstall(setup, done);
  });
};


function standaloneSeleniumJar() {
  var installDir = 'selenium';

  if (!fs.existsSync(installDir)) {
    return false;
  }

  var filename = _.find(fs.readdirSync(installDir), function(filename) {
    return seleniumJarNameExp.test(filename);
  });

  return path.join(installDir, filename);
}

task.standaloneSeleniumJar = standaloneSeleniumJar;

function chromeDriverPath() {
  var sPath = standaloneSeleniumJar();
  var filename = 'chromedriver' + (process.platform === 'win32' ? '.exe' : '');
  var cdPath = path.join(path.dirname(sPath), filename);
  return cdPath;
}

task.chromeDriverPath = chromeDriverPath;
