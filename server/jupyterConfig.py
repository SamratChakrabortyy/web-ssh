""" c.Application.log_datefmt = '%Y-%m-%d %H:%M:%S'
c.Application.log_format = '[%(name)s]%(highlevel)s %(message)s' """

c.NotebookApp.terminals_enabled = False
c.NotebookApp.allow_password_change = False
c.NotebookApp.allow_root = True
#c.NotebookApp.custom_display_url = 'https://web-ssh.machinesense.com/ms-web-ssh-notebook'
c.NotebookApp.open_browser = False
c.NotebookApp.port_retries = 50
c.NotebookApp.shutdown_no_activity_timeout = 600
c.ContentsManager.allow_hidden = True


c.NotebookApp.certfile = '/etc/ssl/certs/star_machinesense_com_bundle.crt'
c.NotebookApp.keyfile = '/etc/ssl/certs/star.machinesense.key'
c.NotebookApp.ip = 'diag.machinesense.com'
c.NotebookApp.allow_remote_access = True
c.NotebookApp.use_redirect_file = False
c.NotebookApp.webbrowser_open_new = 0
## The port the notebook server will listen on (env: JUPYTER_PORT).
c.NotebookApp.port = 4000

