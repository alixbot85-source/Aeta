import { rmSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ApkSigner, SigningKey } from 'apk_sign_ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function commandOutput(cmd, args) { try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } }
function ensure(condition, message) { if (!condition) throw new Error(message); }
function run(cmd, args, opts = {}) { console.log(`$ ${cmd} ${args.join(' ')}`); execFileSync(cmd, args, { stdio: 'inherit', ...opts }); }
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
const appPackage = process.env.AETA_APK_PACKAGE || 'com.aeta.fintech.full';
const smaliPackage = appPackage.replaceAll('.', '/');
const appLabel = process.env.AETA_APK_LABEL || 'Aeta Full';
const versionCode = process.env.AETA_APK_VERSION_CODE || '110';
const versionName = process.env.AETA_APK_VERSION_NAME || '1.1.0';
const unsignedApk = resolve(root, 'artifacts/android/Aeta-full-unsigned.apk');
const signedApk = resolve(root, 'artifacts/android/Aeta-full-signed.apk');
const keyDir = resolve(root, 'artifacts/android/signing');
const keyPem = join(keyDir, 'aeta-local-release.key.pem');
const certPem = join(keyDir, 'aeta-local-release.cert.pem');

ensure(existsSync(distDir), 'frontend/dist is missing. Run ANDROID_APK=true npm run build -w @aeta/frontend first.');
ensure(existsSync(apktoolJar), 'apktool-jar is not installed. Run npm install.');

rmSync(workRoot, { recursive: true, force: true });
mkdirSync(projectDir, { recursive: true });
mkdirSync(join(projectDir, 'assets'), { recursive: true });
mkdirSync(join(projectDir, 'smali', smaliPackage), { recursive: true });
mkdirSync(join(projectDir, 'res'), { recursive: true });

cpSync(distDir, join(projectDir, 'assets'), { recursive: true });
if (existsSync(androidRes)) {
  for (const name of ['mipmap-anydpi-v26','mipmap-hdpi','mipmap-mdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi','drawable','drawable-v24','values']) {
    const src = join(androidRes, name);
    if (existsSync(src)) cpSync(src, join(projectDir, 'res', name), { recursive: true });
  }
}
mkdirSync(join(projectDir, 'res/values'), { recursive: true });
writeFileSync(join(projectDir, 'res/values/strings.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="app_name">${appLabel}</string></resources>\n`);
writeFileSync(join(projectDir, 'res/values/styles.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources><style name="AppTheme" parent="android:style/Theme.Material.NoActionBar"><item name="android:windowNoTitle">true</item><item name="android:windowActionBar">false</item><item name="android:windowLightStatusBar">false</item><item name="android:windowLightNavigationBar">false</item><item name="android:colorAccent">#26A17B</item></style></resources>\n`);

writeFileSync(join(projectDir, 'AndroidManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="${appPackage}" android:versionCode="${versionCode}" android:versionName="${versionName}">
  <uses-sdk android:minSdkVersion="23" android:targetSdkVersion="35" />
  <uses-permission android:name="android.permission.INTERNET" />
  <application android:allowBackup="false" android:usesCleartextTraffic="false" android:supportsRtl="true" android:label="${appLabel}" android:theme="@style/AppTheme" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round">
    <activity android:name=".MainActivity" android:exported="true" android:hardwareAccelerated="true" android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`);

writeFileSync(join(projectDir, 'apktool.yml'), `version: 2.4.1
apkFileName: Aeta-full-signed.apk
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
  versionCode: '${versionCode}'
  versionName: '${versionName}'
resourcesAreCompressed: false
sharedLibrary: false
sparseResources: false
unknownFiles: {}
doNotCompress:
- arsc
`);

const mainType = `L${smaliPackage}/MainActivity;`;
const clientType = `L${smaliPackage}/AetaWebViewClient;`;

writeFileSync(join(projectDir, 'smali', smaliPackage, 'MainActivity.smali'), `.class public ${mainType}
.super Landroid/app/Activity;
.source "MainActivity.java"

.field private webView:Landroid/webkit/WebView;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 5
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, ${mainType}->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setLoadWithOverviewMode(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setUseWideViewPort(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccessFromFileURLs(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V
    const/4 v3, 0x0
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    new-instance v4, ${clientType}
    invoke-direct {v4, p0}, ${clientType}-><init>(Landroid/app/Activity;)V
    invoke-virtual {v0, v4}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V
    const-string v1, "https://aeta.local/index.html"
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    return-void
.end method

.method public onBackPressed()V
    .locals 1
    iget-object v0, p0, ${mainType}->webView:Landroid/webkit/WebView;
    if-eqz v0, :super_back
    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v0
    if-eqz v0, :super_back
    iget-object v0, p0, ${mainType}->webView:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void
  :super_back
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method
`);

writeFileSync(join(projectDir, 'smali', smaliPackage, 'AetaWebViewClient.smali'), `.class public ${clientType}
.super Landroid/webkit/WebViewClient;
.source "AetaWebViewClient.java"

.field private activity:Landroid/app/Activity;

.method public constructor <init>(Landroid/app/Activity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
    iput-object p1, p0, ${clientType}->activity:Landroid/app/Activity;
    return-void
.end method

.method public shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
    .locals 1
    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->getUrl()Landroid/net/Uri;
    move-result-object v0
    invoke-virtual {v0}, Landroid/net/Uri;->toString()Ljava/lang/String;
    move-result-object v0
    invoke-direct {p0, v0}, ${clientType}->assetResponse(Ljava/lang/String;)Landroid/webkit/WebResourceResponse;
    move-result-object v0
    if-eqz v0, :fallback
    return-object v0
  :fallback
    invoke-super {p0, p1, p2}, Landroid/webkit/WebViewClient;->shouldInterceptRequest(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;)Landroid/webkit/WebResourceResponse;
    move-result-object v0
    return-object v0
.end method

.method public shouldInterceptRequest(Landroid/webkit/WebView;Ljava/lang/String;)Landroid/webkit/WebResourceResponse;
    .locals 1
    invoke-direct {p0, p2}, ${clientType}->assetResponse(Ljava/lang/String;)Landroid/webkit/WebResourceResponse;
    move-result-object v0
    if-eqz v0, :fallback
    return-object v0
  :fallback
    invoke-super {p0, p1, p2}, Landroid/webkit/WebViewClient;->shouldInterceptRequest(Landroid/webkit/WebView;Ljava/lang/String;)Landroid/webkit/WebResourceResponse;
    move-result-object v0
    return-object v0
.end method

.method private assetResponse(Ljava/lang/String;)Landroid/webkit/WebResourceResponse;
    .locals 7
    const-string v0, "https://aeta.local/"
    invoke-virtual {p1, v0}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
    move-result v1
    if-nez v1, :local_url
    const/4 v0, 0x0
    return-object v0
  :local_url
    const/16 v1, 0x13
    invoke-virtual {p1, v1}, Ljava/lang/String;->substring(I)Ljava/lang/String;
    move-result-object v2
    const-string v3, ""
    invoke-virtual {v2, v3}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v3
    if-nez v3, :index
    const-string v3, "/"
    invoke-virtual {v2, v3}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v3
    if-eqz v3, :mime
  :index
    const-string v2, "index.html"
  :mime
    const-string v3, "application/octet-stream"
    const-string v4, ".html"
    invoke-virtual {v2, v4}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v4
    if-eqz v4, :check_js
    const-string v3, "text/html"
    goto :open
  :check_js
    const-string v4, ".js"
    invoke-virtual {v2, v4}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v4
    if-eqz v4, :check_css
    const-string v3, "application/javascript"
    goto :open
  :check_css
    const-string v4, ".css"
    invoke-virtual {v2, v4}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v4
    if-eqz v4, :check_png
    const-string v3, "text/css"
    goto :open
  :check_png
    const-string v4, ".png"
    invoke-virtual {v2, v4}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v4
    if-eqz v4, :check_svg
    const-string v3, "image/png"
    goto :open
  :check_svg
    const-string v4, ".svg"
    invoke-virtual {v2, v4}, Ljava/lang/String;->endsWith(Ljava/lang/String;)Z
    move-result v4
    if-eqz v4, :open
    const-string v3, "image/svg+xml"
  :open
    :try_start
    iget-object v4, p0, ${clientType}->activity:Landroid/app/Activity;
    invoke-virtual {v4}, Landroid/app/Activity;->getAssets()Landroid/content/res/AssetManager;
    move-result-object v4
    invoke-virtual {v4, v2}, Landroid/content/res/AssetManager;->open(Ljava/lang/String;)Ljava/io/InputStream;
    move-result-object v4
    new-instance v5, Landroid/webkit/WebResourceResponse;
    const-string v6, "UTF-8"
    invoke-direct {v5, v3, v6, v4}, Landroid/webkit/WebResourceResponse;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/io/InputStream;)V
    :try_end
    .catch Ljava/lang/Exception; {:try_start .. :try_end} :catch
    return-object v5
  :catch
    const/4 v0, 0x0
    return-object v0
.end method
`);

run(javaBin, ['-jar', apktoolJar, 'b', projectDir, '-o', unsignedApk, '--use-aapt2']);

mkdirSync(keyDir, { recursive: true });
if (!existsSync(keyPem) || !existsSync(certPem)) {
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPem, '-out', certPem, '-days', '3650', '-subj', '/CN=Aeta Local Release/O=Aeta/OU=Installable Demo/C=FI']);
}
const signer = new ApkSigner({ signingKey: SigningKey.fromPEM(readFileSync(keyPem, 'utf8'), readFileSync(certPem, 'utf8')), digestAlgorithm: 'SHA-256' });
const { signedApk: signed } = await signer.sign(new Uint8Array(readFileSync(unsignedApk)));
writeFileSync(signedApk, signed);
rmSync(keyDir, { recursive: true, force: true });
console.log(`\nAPK ready: ${signedApk}`);
