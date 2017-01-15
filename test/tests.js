QUnit.begin(function () {
  KeratinAuthN.setHost('https://authn.example.com');
  KeratinAuthN.setSessionName('authn');
});

QUnit.testDone(function () {
  deleteCookie('authn');
});

function jwt(payload) {
  var metadata = {};
  var signature = 'BEEF';
  return btoa(JSON.stringify(metadata)) + '.' +
         btoa(JSON.stringify(payload)) + '.' +
         btoa(signature);
}

function idToken(options) {
  var age = options.age || 600;
  var iat = Math.floor(Date.now() / 1000) - age;
  return jwt({
    sub: 1,
    iat: iat,
    exp: iat + 3600
  });
}

function jsonResult(data) {
  return JSON.stringify({result: data});
}

function jsonErrors(data) {
  var errors = Object.keys(data)
    .map(function(k){ return {field: k, message: data[k]} });

  return JSON.stringify({errors: errors})
}

function readCookie(name) {
  return document.cookie.replace(new RegExp('/(?:(?:^|.*;\s*)' + name + '\s*\=\s*([^;]*).*$)|^.*$'), "$1");
}

function writeCookie(name, val) {
  document.cookie = name + '=' + val + ';';
}

function deleteCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

var startServer = {
  beforeEach: function () {
    this.server = sinon.fakeServer.create({respondImmediately: true});
  },
  afterEach: function () {
    this.server.restore();
  }
};

QUnit.module("api signup", startServer);
QUnit.test("success", function(assert) {
  this.server.respondWith('POST', 'https://authn.example.com/accounts',
    jsonResult({id_token: idToken({age: 1})})
  );

  return KeratinAuthN.signup({username: 'test', password: 'test'})
    .then(function (token) {
      assert.ok(token.length > 0, "token is a string of some length");
      assert.equal(token.split('.').length, 3, "token has three parts");

      // NOTE: this test will fail when qunit is run in a browser with the
      //       `file:///` protocol
      if (window.location.protocol != 'file:') {
        assert.equal(readCookie('authn'), token, "token is saved as cookie");
      }
    });
});

QUnit.test("failure", function(assert) {
  this.server.respondWith('POST', 'https://authn.example.com/accounts',
    jsonErrors({foo: 'bar'})
  );

  return KeratinAuthN.signup({username: 'test', password: 'test'})
    .then(function (data) { assert.ok(false, "should not succeed") })
    .catch(function (errors) {
      assert.equal(errors.length, 1, "one error");
      assert.equal(errors[0].field, 'foo', 'error has field');
      assert.equal(errors[0].message, 'bar', 'error has message');
    });
});

QUnit.test("double submit", function(assert) {
  var done = assert.async(2);

  this.server.respondImmediately = false;
  this.server.respondWith('POST', 'https://authn.example.com/accounts',
    jsonResult({id_token: idToken({age: 1})})
  );

  KeratinAuthN.signup({username: 'test', password: 'test'})
    .then(function (data) { assert.ok(true, "first request finished") })
    .then(done);

  KeratinAuthN.signup({username: 'test', password: 'test'})
    .then(function (data) { assert.ok(false, "should not proceed") })
    .catch(function(errors) {
      assert.equal(errors, "duplicate", "caught duplicate request");
      done();
    })

  this.server.respond();
});

QUnit.module("setSessionName", startServer);
QUnit.test("no existing session", function(assert) {
  deleteCookie('authn');
  KeratinAuthN.setSessionName('authn');
  assert.notOk(KeratinAuthN.session(), "no session");
});

QUnit.test("existing session", function(assert) {
  writeCookie('authn', idToken({age: 1}));
  KeratinAuthN.setSessionName('authn');
  assert.ok(KeratinAuthN.session(), "session found");
});

QUnit.test("aging session", function(assert) {
  var done = assert.async();
  var oldSession = idToken({age: 3000});
  var newSession = idToken({age: 1});

  this.server.respondWith('GET', 'https://authn.example.com/sessions/refresh',
    jsonResult({id_token: newSession})
  );

  writeCookie('authn', oldSession);
  KeratinAuthN.setSessionName('authn');
  assert.equal(KeratinAuthN.session().token, oldSession, "session found is old");
  setTimeout(function () {
    assert.equal(KeratinAuthN.session().token, newSession, "session is updated");
    done();
  }, 10);
});

// isAvailable()
// refresh()
// login()
// logout()
