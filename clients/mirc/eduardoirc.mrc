; EduardoIRC mIRC helper
; Load in mIRC with: /load -rs C:\Users\duzit\source\irc\clients\mirc\eduardoirc.mrc
; Then run: /eduardoirc

alias eduardoirc {
  echo -a Connecting to EduardoIRC locally with TLS...
  server -m 127.0.0.1:+6697
}

alias eduardoirc-lan {
  echo -a Connecting to EduardoIRC on the LAN with TLS...
  server -m 192.168.68.57:+6697
}

alias eduardoirc-public {
  echo -a Connecting to EduardoIRC public DNS with TLS...
  server -m irc.eduardosilveira.dev:+6697
}

menu status {
  EduardoIRC
  .Connect local:/eduardoirc
  .Connect LAN:/eduardoirc-lan
  .Connect public:/eduardoirc-public
}
