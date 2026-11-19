package io.github.haruko386.picshader

import android.app.Activity
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.*
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

class StudioActivity : Activity() {
    private lateinit var web: WebView
    private val host = "appassets.androidplatform.net"
    private val selected = ConcurrentHashMap<String, Uri>()
    private var pending: File? = null
    private var stream: OutputStream? = null

    override fun onCreate(saved: Bundle?) {
        super.onCreate(saved)
        web = WebView(this)
        setContentView(web)
        web.setOnApplyWindowInsetsListener { view, insets ->
            view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            insets
        }
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = true
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) = resource(request.url)
        }
        web.addJavascriptInterface(Bridge(), "StudioPhone")
        web.loadUrl("https://"+host+"/index.html")
    }

    private fun resource(uri: Uri): WebResourceResponse {
        val path = uri.path.orEmpty().removePrefix("/")
        try {
            require(uri.scheme=="https" && uri.host==host && path.split('/').none { it==".." })
            val photo = path.startsWith("picked/")
            val data = if (photo) contentResolver.openInputStream(selected[path.substringAfter('/')] ?: error("missing"))!! else assets.open(path)
            val type = if (photo) "application/octet-stream" else when(path.substringAfterLast('.')) {
                "html" -> "text/html"; "css" -> "text/css"; "js" -> "text/javascript"; "wasm" -> "application/wasm"
                "svg" -> "image/svg+xml"; "png" -> "image/png"; else -> "application/octet-stream"
            }
            return WebResourceResponse(type, null, 200, "OK", mapOf("Cross-Origin-Opener-Policy" to "same-origin",
                "Cross-Origin-Embedder-Policy" to "require-corp", "Cache-Control" to "no-store",
                "X-Content-Type-Options" to "nosniff"), data)
        } catch (_: Exception) { return WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), null) }
    }

    inner class Bridge {
        @JavascriptInterface fun dark() = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        @JavascriptInterface fun pick(folder: Boolean) = runOnUiThread {
            val intent = if(folder) Intent(Intent.ACTION_OPEN_DOCUMENT_TREE) else Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                type="*/*"; addCategory(Intent.CATEGORY_OPENABLE); putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true)
            }
            try { startActivityForResult(intent, if(folder) 2 else 1) } catch (_: Exception) { message("无法打开系统文件选择器") }
        }
        @JavascriptInterface @Synchronized fun begin(): Boolean {
            if(pending!=null) return false
            return try {
                pending=File.createTempFile("export-", ".image",cacheDir)
                stream=pending!!.outputStream()
                true
            } catch (_: Exception) { clearExport(); false }
        }
        @JavascriptInterface fun append(encoded: String): Boolean = try {
            require(encoded.length<=350000)
            checkNotNull(stream).write(Base64.decode(encoded,Base64.NO_WRAP))
            true
        } catch (_: Exception) { clearExport(); false }
        @JavascriptInterface fun cancel() { clearExport() }
        @JavascriptInterface fun save(name: String, png: Boolean) {
            checkNotNull(stream).close();stream=null
            runOnUiThread {
                try {startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE);type=if(png)"image/png" else "image/jpeg"
                    putExtra(Intent.EXTRA_TITLE,name.substringAfterLast('/'))
                },3)} catch (_: Exception) {clearExport();message("无法打开保存位置")}
            }
        }
    }

    private fun clearExport() { try {stream?.close()} catch (_: Exception) {} ;stream=null;pending?.delete();pending=null }
    private fun message(text: String) = runOnUiThread {Toast.makeText(this,text,Toast.LENGTH_SHORT).show()}
    override fun onConfigurationChanged(config: Configuration) {
        super.onConfigurationChanged(config)
        web.evaluateJavascript("window.syncPhoneTheme?.()",null)
    }
    override fun onActivityResult(request: Int, result: Int, data: Intent?) {
        super.onActivityResult(request,result,data)
        if(request==3) {
            val dest=data?.data;val file=pending
            if(result!=RESULT_OK || dest==null || file==null){clearExport();return}
            thread {
                try {contentResolver.openOutputStream(dest,"wt")!!.use { output -> file.inputStream().use { it.copyTo(output) } };message("已保存")}
                catch (_: Exception){message("保存失败")}
                finally {clearExport()}
            }
            return
        }
        if(result!=RESULT_OK || data==null || request !in 1..2)return
        thread {
            try {
                val batch=JSONArray()
                fun add(uri: Uri,name: String,path: String) {
                    if(uri.scheme!="content")return
                    val key=UUID.randomUUID().toString()
                    selected[key]=uri
                    batch.put(JSONObject().put("name",name).put("webkitRelativePath",path).put("source","/picked/"+key))
                }
                if(request==1){
                    val clip=data.clipData
                    val uris=if(clip!=null)(0 until clip.itemCount).map {clip.getItemAt(it).uri} else listOfNotNull(data.data)
                    for(uri in uris){
                        contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME),null,null,null)?.use {
                            if(it.moveToFirst())add(uri,it.getString(0),"")
                        }
                    }
                } else {
                    val tree=data.data ?: return@thread
                    val todo=java.util.ArrayDeque<Pair<String,String>>()
                    val visited=HashSet<String>()
                    todo.add(DocumentsContract.getTreeDocumentId(tree) to "")
                    while(todo.isNotEmpty()){
                        val (parent,prefix)=todo.removeFirst()
                        if(!visited.add(parent))continue
                        val children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parent)
                        contentResolver.query(children,arrayOf(Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE),null,null,null)?.use {
                            while(it.moveToNext()){
                                val id=it.getString(0);val name=it.getString(1)
                                if(it.getString(2)==Document.MIME_TYPE_DIR)todo.add(id to (prefix+name+"/"))
                                else add(DocumentsContract.buildDocumentUriUsingTree(tree,id),name,prefix+name)
                            }
                        }
                    }
                }
                runOnUiThread {web.evaluateJavascript("addFiles("+batch.toString()+")",null)}
            } catch (_: Exception){message("无法读取所选文件")}
        }
    }
    override fun onDestroy() {clearExport();web.removeJavascriptInterface("StudioPhone");web.destroy();super.onDestroy()}
}
