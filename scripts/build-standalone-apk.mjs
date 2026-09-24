import { rmSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ApkSigner, SigningKey } from 'apk_sign_ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function commandOutput(cmd, args) { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } }
function resolveJavaBin() {
  if (process.env.JAVA_BIN && existsSync(process.env.JAVA_BIN)) return process.env.JAVA_BIN;
  if (process.env.JAVA_HOME && existsSync(join(process.env.JAVA_HOME, 'bin', 'java'))) return join(process.env.JAVA_HOME, 'bin', 'java');
  const pathJava = commandOutput('bash', ['-lc', 'command -v java']);
  if (pathJava) return pathJava;
  const localTarget = resolve(root, 'artifacts/android/.jdk4py');
  const localJava = join(localTarget, 'jdk4py/java-runtime/bin/java');
  if (!existsSync(localJava)) {
    console.log('No system Java found; bootstrapping portable Java runtime via jdk4py...');
    mkdirSync(localTarget, { recursive: true });
    run('python3', ['-m', 'pip', 'install', '--quiet', '--target', localTarget, 'jdk4py==17.0.9.2']);
  }
  ensure(existsSync(localJava), 'Portable Java runtime bootstrap failed.');
  return localJava;
}
const javaBin = resolveJavaBin();
const apktoolJar = resolve(root, 'node_modules/apktool-jar/bin/apktool_2.4.1.jar');
const distDir = resolve(root, 'frontend/dist');
const androidRes = resolve(root, 'frontend/android/app/src/main/res');
const workRoot = resolve(root, 'artifacts/android/work');
const projectDir = join(workRoot, 'aeta-apktool');
const unsignedApk = resolve(root, 'artifacts/android/Aeta-demo-unsigned.apk');
const signedApk = resolve(root, 'artifacts/android/Aeta-demo-debug.apk');
const keyDir = resolve(root, 'artifacts/android/signing');
const keyPem = join(keyDir, 'aeta-debug.key.pem');
const certPem = join(keyDir, 'aeta-debug.cert.pem');

function ensure(condition, message) { if (!condition) throw new Error(message); }
function run(cmd, args, opts = {}) { console.log(`$ ${cmd} ${args.join(' ')}`); execFileSync(cmd, args, { stdio: 'inherit', ...opts }); }

ensure(existsSync(distDir), 'frontend/dist is missing. Run ANDROID_APK=true npm run build -w @aeta/frontend first.');
ensure(existsSync(apktoolJar), 'apktool-jar is not installed. Run npm install.');

rmSync(workRoot, { recursive: true, force: true });
mkdirSync(projectDir, { recursive: true });
mkdirSync(join(projectDir, 'assets'), { recursive: true });
mkdirSync(join(projectDir, 'smali/com/aeta/fintech'), { recursive: true });
mkdirSync(join(projectDir, 'res'), { recursive: true });

cpSync(distDir, join(projectDir, 'assets'), { recursive: true });
if (existsSync(androidRes)) {
  for (const name of ['mipmap-anydpi-v26','mipmap-hdpi','mipmap-mdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi','drawable','drawable-v24','values']) {
    const src = join(androidRes, name);
    if (existsSync(src)) cpSync(src, join(projectDir, 'res', name), { recursive: true });
  }
}
mkdirSync(join(projectDir, 'res/values'), { recursive: true });
writeFileSync(join(projectDir, 'res/values/strings.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="app_name">Aeta</string></resources>\n`);
writeFileSync(join(projectDir, 'res/values/styles.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources><style name="AppTheme" parent="android:style/Theme.Material.NoActionBar"><item name="android:windowNoTitle">true</item><item name="android:windowActionBar">false</item></style></resources>\n`);

writeFileSync(join(projectDir, 'AndroidManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.aeta.fintech" android:versionCode="3" android:versionName="1.0.3">
  <uses-sdk android:minSdkVersion="23" android:targetSdkVersion="35" />
  <uses-permission android:name="android.permission.INTERNET" />
  <application android:allowBackup="false" android:usesCleartextTraffic="false" android:supportsRtl="true" android:label="Aeta" android:theme="@android:style/Theme.Material.NoActionBar" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round">
    <activity android:name=".MainActivity" android:exported="true" android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`);

writeFileSync(join(projectDir, 'apktool.yml'), `version: 2.4.1
apkFileName: Aeta-demo-debug.apk
isFrameworkApk: false
usesFramework:
  ids:
  - 1
sdkInfo:
  minSdkVersion: '23'
  targetSdkVersion: '35'
packageInfo:
  forcedPackageId: '127'
versionInfo:
  versionCode: '3'
  versionName: '1.0.3'
resourcesAreCompressed: false
sharedLibrary: false
sparseResources: false
unknownFiles: {}
doNotCompress:
- arsc
`);

writeFileSync(join(projectDir, 'smali/com/aeta/fintech/MainActivity.smali'), `.class public Lcom/aeta/fintech/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

.field private webView:Landroid/webkit/WebView;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 4
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/aeta/fintech/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setLoadWithOverviewMode(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setUseWideViewPort(Z)V
    const/4 v3, 0x0
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    new-instance v1, Landroid/webkit/WebViewClient;
    invoke-direct {v1}, Landroid/webkit/WebViewClient;-><init>()V
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V
    const-string v1, "file:///android_asset/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    return-void
.end method

.method public onBackPressed()V
    .locals 1
    iget-object v0, p0, Lcom/aeta/fintech/MainActivity;->webView:Landroid/webkit/WebView;
    if-eqz v0, :super_back
    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v0
    if-eqz v0, :super_back
    iget-object v0, p0, Lcom/aeta/fintech/MainActivity;->webView:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void
  :super_back
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method
`);

run(javaBin, ['-jar', apktoolJar, 'b', projectDir, '-o', unsignedApk, '--use-aapt2']);

mkdirSync(keyDir, { recursive: true });
if (!existsSync(keyPem) || !existsSync(certPem)) {
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPem, '-out', certPem, '-days', '3650', '-subj', '/CN=Aeta Demo APK/O=Aeta/OU=Demo/C=FI']);
}
const signer = new ApkSigner({ signingKey: SigningKey.fromPEM(readFileSync(keyPem, 'utf8'), readFileSync(certPem, 'utf8')), digestAlgorithm: 'SHA-256' });
const { signedApk: signed } = await signer.sign(new Uint8Array(readFileSync(unsignedApk)));
writeFileSync(signedApk, signed);
rmSync(keyDir, { recursive: true, force: true });
console.log(`\nAPK ready: ${signedApk}`);
