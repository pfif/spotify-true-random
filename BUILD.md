# To make the app run locally

```git
diff --git a/.gitignore b/.gitignore
index b0a5c34..8574fe2 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,2 +1 @@
-/node_modules/
-/dist/
+BUILD.md
diff --git a/src/js/script.js b/src/js/script.js
index 7686b94..3f06245 100755
--- a/src/js/script.js
+++ b/src/js/script.js
@@ -1,6 +1,6 @@
 const spotifyRandom = (() => {
-    const clientId = 'b61d28d1ed4c49e8ba5d2923ed367262';
-    const redirect = 'https://tomeraberba.ch/spotify-true-random';
+    const clientId = '00aae22a1f2943df8cbe5c5f8c0bd3c3';
+  const redirect = 'http://127.0.0.1:8000';
     const scope = [
         'playlist-read-private',
         'playlist-read-collaborative',

```
# To run the program
```
npx gulp && python -m http.server --directory dist/
```
