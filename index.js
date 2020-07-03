const path = require('path');
const exec = require('shelljs.exec');
const {spawn} = require('child_process');
const ping = require('ping');
// GITHUB
const core = require('@actions/core');

async function startOvpn(finalPath) {
  const {stdout, stderr} = await exec(
    `sudo openvpn --config ${finalPath} --ca ca.crt --key user.key --cert user.crt --daemon`,
  );

  if (stderr) {
    core.setFailed(`Can't setup config ${finalPath}
      error: ${stderr}`);
    process.exit(1);
  }
  console.log(`Log - ${stdout}`);
}

try {
  // Get input defined in action metadata file
  const pingURL = core.getInput('PING_URL');
  const fileOVPN = core.getInput('FILE_OVPN');
  const secret = core.getInput('SECRET');
  const tlsKey = core.getInput('TLS_KEY');

  if (process.env.CA_CRT == null) {
    core.setFailed(`Can't get ca cert please add CA_CRT in secret`);
    process.exit(1);
  }

  if (process.env.USER_CRT == null) {
    core.setFailed(`Can't get user cert please add USER_CRT in secret`);
    process.exit(1);
  }

  if (process.env.USER_KEY == null) {
    core.setFailed(`Can't get user key please add USER_KEY in secret`);
    process.exit(1);
  }

  const finalPath = path.resolve(process.cwd(), fileOVPN);

  const createFile = (filename, data) => {
    if (exec('echo ' + data + ' |base64 -d >> ' + filename).code !== 0) {
      core.setFailed(`Can't create file ${filename}`);
      process.exit(1);
    } else {
      if (exec('sudo chmod 600 ' + filename).code !== 0) {
        core.setFailed(`Can't set permission file ${filename}`);
        process.exit(1);
      }
    }
  };

  if (secret !== '') {
    createFile('secret.txt', secret);
  }
  if (tlsKey !== '') {
    createFile('tls.key', tlsKey);
  }

  createFile('ca.crt', process.env.CA_CRT);
  createFile('user.crt', process.env.USER_CRT);
  createFile('user.key', process.env.USER_KEY);

  // startOvpn(finalPath);

  const child = spawn('sudo', [
    'openvpn',
    -'-config',
    finalPath,
    '--ca',
    'ca.crt',
    '--key',
    'user.key',
    '--cert',
    'user.crt',
    '--daemon',
  ]);

  child.stdout.on('data', data => {
    console.log(`child stdout:\n${data}`);
  });

  child.stderr.on('data', data => {
    console.log(`child sterr:\n${data}`);
  });
  // if (
  //   exec(
  //     `sudo openvpn --config ${finalPath} --ca ca.crt --key user.key --cert user.crt --daemon`,
  //   ).code !== 0
  // ) {
  //   core.setFailed(`Can't setup config ${finalPath}
  //     error: ${stderr}`)
  //   process.exit(1)
  // }

  ping.promise
    .probe(pingURL, {
      timeout: 15,
      min_reply: 15,
    })
    .then(function(res) {
      if (res.alive) {
        core.info('Connect vpn passed');
        core.setOutput('STATUS', true);
      } else {
        core.setFailed('Connect vpn failed');
        core.setOutput('STATUS', false);
      }
    });
} catch (error) {
  core.setFailed(error.message);
}
