# mIRC Helper

Load the helper script in mIRC:

```text
/load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
```

Then connect locally:

```text
/eduardoirc
```

Other aliases:

```text
/eduardoirc-lan
/eduardoirc-public
```

The script uses `+6697`, which tells mIRC to connect with SSL/TLS. If mIRC asks about the local self-signed certificate, accept it for local testing.

If repeated retries caused server throttling, restart the server before trying again:

```powershell
docker compose restart ergo
```
