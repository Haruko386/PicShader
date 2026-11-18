using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class StudioWindow : Form
{
    private readonly WebView2 view = new WebView2 { Dock = DockStyle.Fill };
    private const string Origin = "https://frame-studio.local";

    internal StudioWindow()
    {
        Text = "映框";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.CenterScreen;
        Size area = Screen.PrimaryScreen.WorkingArea.Size;
        Size = new Size(Math.Min(1320, area.Width), Math.Min(880, area.Height));
        MinimumSize = new Size(Math.Min(780, area.Width), Math.Min(520, area.Height));
        Controls.Add(view);
        Shown += Initialize;
    }

    private async void Initialize(object sender, EventArgs args)
    {
        try
        {
            string app = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
            if (!File.Exists(Path.Combine(app, "index.html"))) throw new FileNotFoundException("请先完整解压便携包，不要单独移动 EXE。");
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PicShader", "WebView2");
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, profile);
            await view.EnsureCoreWebView2Async(environment);
            var core = view.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.SetVirtualHostNameToFolderMapping("frame-studio.local", app, CoreWebView2HostResourceAccessKind.Deny);
            core.NavigationStarting += (source, evt) => { if (evt.Uri != Origin + "/index.html") evt.Cancel = true; };
            core.NewWindowRequested += (source, evt) => { evt.Handled = true; };
            core.DownloadStarting += ChooseDestination;
            core.PermissionRequested += (source, evt) => {
                if (evt.PermissionKind == CoreWebView2PermissionKind.MultipleAutomaticDownloads && evt.Uri.StartsWith(Origin + "/", StringComparison.Ordinal))
                    evt.State = CoreWebView2PermissionState.Allow;
            };
            core.Navigate(Origin + "/index.html");
        }
        catch (WebView2RuntimeNotFoundException) { Fail("未找到 Microsoft Edge WebView2 运行时。请安装 Evergreen x64 运行时后重试。"); }
        catch (Exception error) { Fail(error.Message); }
    }

    private void Fail(string message)
    {
        MessageBox.Show(this, message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
        Close();
    }

    private void ChooseDestination(object sender, CoreWebView2DownloadStartingEventArgs args)
    {
        var task = args.DownloadOperation;
        if (!task.Uri.StartsWith("blob:" + Origin + "/", StringComparison.Ordinal)) { args.Cancel = true; return; }
        var deferral = args.GetDeferral();
        args.Handled = true;
        BeginInvoke((Action)(() => {
            try
            {
                using (var dialog = new SaveFileDialog())
                {
                    bool png = Path.GetExtension(args.ResultFilePath).Equals(".png", StringComparison.OrdinalIgnoreCase);
                    dialog.Title = "导出照片";
                    dialog.Filter = png ? "PNG 图像 (*.png)|*.png" : "JPEG 图像 (*.jpg)|*.jpg";
                    dialog.FileName = Path.GetFileName(args.ResultFilePath);
                    dialog.DefaultExt = png ? "png" : "jpg";
                    dialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
                    if (dialog.ShowDialog(this) != DialogResult.OK) { args.Cancel = true; return; }
                    args.ResultFilePath = dialog.FileName;
                    task.StateChanged += (source, evt) => {
                        if (IsDisposed || view.CoreWebView2 == null) return;
                        if (task.State == CoreWebView2DownloadState.Completed) view.CoreWebView2.PostWebMessageAsString("已保存：" + Path.GetFileName(task.ResultFilePath));
                        else if (task.State == CoreWebView2DownloadState.Interrupted) view.CoreWebView2.PostWebMessageAsString("保存未完成，请检查路径与可用空间。");
                    };
                }
            }
            catch (Exception error) { args.Cancel = true; MessageBox.Show(this, error.Message, "导出失败"); }
            finally { deferral.Complete(); }
        }));
    }

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new StudioWindow());
    }
}
