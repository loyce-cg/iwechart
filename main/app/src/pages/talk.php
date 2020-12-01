<?php
return function($model) {
$model->i18nData = array(
    "pl" => array(
      "title" => "PrivMX",
      "title2" => "PrivMX bezpieczna rozmowa",
      "subtitle" => "Szyfrowanie end-to-end",
      "subtitle.short" => "End-to-end",
      "popupMessage" =>  "Wszystkie dane z formularza przed wysłaniem zostaną zaszyfrowane na"
                        ." Twoim komputerze. Następnie będą przesyłane i składowane na serwerze w"
                        ." postaci nieczytelnej (nawet dla administratorów!). Odszyfrowane będą"
                        ." dopiero na komputerze odbiorcy tej wiadomości.",

      "login.privateTalk" => "Prywatna rozmowa z",
      "login.encInfo" => "Wiadomości są zabezpieczone hasłem.",
      "login.hintInfo" => "Wiadomości są zabezpieczone hasłem. Ustawiono krótką podpowiedź.",
      "login.header" => "Wpisz hasło",
      "login.password" => "Hasło",
      "login.password.required" => "Proszę podać hasło",
      "login.showHint" => "Pokaż podpowiedź do hasła",
      "login.hint" => "Podpowiedź",
      "login.submit" => "Pokaż wiadomości",
      "login.error.unknown" => "Niespodziewany błąd",
      "login.error.invalid" => "Niepoprawne hasło",
      "footer" => "PrivMX",
      "messages.you" => "Ty",
      "messages.new" => "NOWE",
      "messages.previous" => "POPRZEDNIE",
      "messages.messages" => "WIADOMOŚCI",
      "messages.sorter.fromTheNewest" => "od najnowszej",
      "messages.sorter.fromTheOldsest" => "od najstarszej",
      "messages.post.avatar" => "Avatar",
      "messages.buttons.reply" => "Pisz",
      "messages.buttons.continue" => "Pisz",
      "messages.buttons.files" => "Pokaż pliki",
      "messages.buttons.files.short" => "Pliki",
      "messages.buttons.files.showAll" => "Pokaż wszystko",
      "messages.error.read" => "Błąd przy odczycie wiadomości",
      "messages.error.downloadAttachment" => "Błąd podczas pobierania załącznika",
      "messages.quote" => "cytuj",
      "messages.quote.text" => "W dniu {0}, {1} pisze:",
      "newMessage.header" => "Odpowiedz do",
      "newMessage.body" => "Twoja wiadomość...",
      "newMessage.deleteAttachment" => "Usuń",
      "newMessage.buttons.send" => "Wyślij",
      "newMessage.buttons.addAttachment" => "Dodaj załącznik",
      "newMessage.attachment.max" => "max 20 MB",
      "newMessage.buttons.cancel" => "Anuluj",
      "newMessage.buttons.showMessages" => "Czytaj",
      "newMessage.question" => "Czy chcesz wysłać tę wiadomość?",
      "newMessage.error" => "Błąd podczas wysyłania wiadomości",
      "alert.ok" => "OK",
      "alert.yes" => "Tak",
      "alert.no" => "Nie",
      "core.toggleQuote" => "pokaż cytat",
      "core.hideQuote" => "ukryj cytat",
      "core.showContent" => "pokaż treść",
      "core.hideContent" => "ukryj treść",
      "relogin.error" => "Nie można połączyć się z serwerem. Sprawdź swoje połączenie lub spróbuj ponownie później.",
      "relogin.connectionLost" => "Utracono połączenie",
      "relogin.reconnect" => "Odnów połączenie"
    ),
    "en" => array(
      "title" => "PrivMX",
      "title2" => "PrivMX secure talk",
      "subtitle" => "End-to-end encryption",
      "subtitle.short" => "End-to-end",
      "popupMessage" =>  "All the data placed inside this form will be encrypted on your computer, "
                        ."next - sent and stored on a server in a secure way (unreadable to anybody - even admin). "
                        ."The data will be finally decrypted on a message receiver's computer.",
      "login.privateTalk" => "Private talk with",
      "login.encInfo" => "Messages are secured by a password.",
      "login.hintInfo" => "Messages are secured by a password. A short hint has been set.",
      "login.header" => "Enter password",
      "login.password" => "Password",
      "login.password.required" => "Please type password",
      "login.showHint" => "Show the hint for the password",
      "login.hint" => "Hint",
      "login.submit" => "Show messages",
      "login.error.unknown" => "Unexpected error",
      "login.error.invalid" => "Incorrect password",
      "footer" => "PrivMX",
      "messages.you" => "You",
      "messages.new" => "NEW",
      "messages.previous" => "PREVIOUS",
      "messages.messages" => "MESSAGES",
      "messages.sorter.fromTheNewest" => "newest first",
      "messages.sorter.fromTheOldsest" => "oldest first",
      "messages.post.avatar" => "Avatar",
      "messages.buttons.reply" => "Write",
      "messages.buttons.continue" => "Write",
      "messages.buttons.files" => "Show files",
      "messages.buttons.files.short" => "Files",
      "messages.buttons.files.showAll" => "Show all",
      "messages.error.read" => "Error during fetching messages",
      "messages.error.downloadAttachment" => "Error during downloading attachment",
      "messages.quote" => "quote",
      "messages.quote.text" => "On {0}, {1} wrote:",
      "newMessage.header" => "Reply to",
      "newMessage.body" => "Your message...",
      "newMessage.deleteAttachment" => "Delete",
      "newMessage.buttons.send" => "Send",
      "newMessage.buttons.addAttachment" => "Add attachment",
      "newMessage.attachment.max" => "max 20 MB",
      "newMessage.buttons.cancel" => "Cancel",
      "newMessage.buttons.showMessages" => "Read",
      "newMessage.question" => "Do you want to send this message?",
      "newMessage.error" => "Error during sending message",
      "alert.ok" => "OK",
      "alert.yes" => "Yes",
      "alert.no" => "No",
      "core.toggleQuote" => "show quote",
      "core.hideQuote" => "hide quote",
      "core.showContent" => "show content",
      "core.hideContent" => "hide content",
      "relogin.error" => "Cannot connect to server. Check your connection or try again later.",
      "relogin.connectionLost" => "Connection lost",
      "relogin.reconnect" => "Refresh connection"
    )
);

?><!DOCTYPE html>
<html lang="<?= $model->lang ?>">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="cache-control" content="public, no-cache" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="<?= $model->getAsset("app/pages-assets/pure-release-1.0.0/pure-min.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/pages-assets/pure-release-1.0.0/grids-responsive-min.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/pages-assets/pmxtalk.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/themes/default/css/fonts.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/themes/default/css/font-awesome.min.css") ?>" media="all" rel="stylesheet" />
    <link rel="shortcut icon" href="favicon.ico" />
    <title><?= $model->i18n("title") ?></title>
    <script type="text/javascript" src="<?= $model->getAsset("app/build/privmx-core.js") ?>"></script>
    <script type="text/javascript" src="<?= $model->getAsset("app/build/privmx-view-lite.js") ?>"></script>
    <script type="text/javascript">
      var DEFAULT_AVATAR_URL = "<?= $model->getAsset("app/icons/user-default.png") ?>";
      var DEFAULT_EMAIL_URL = "<?= $model->getAsset("app/icons/email-default.png") ?>";
      var HASHMAIL = "<?= $model->lowUserHashmail ?>";
      var LANG = "<?= $model->lang ?>";
      var PASSWORD = "<?= $model->emptyPassword ? "empty" : "normal" ?>";
      var I18N_DATA = {
<?php
foreach ($model->i18nData[$model->lang] as $key => $value) {
  echo("        \"$key\": \"$value\",\n");
}
?>
      };
      var privmxCore = privmxCoreRequire("privmx-core");
      privmxCore.TalkPage.View.init();
    </script>
  </head>
  <body class="lg-show-all-msg">

    <div id="layout" class="pure-g pmxlayout">
      <div class="header pure-u-1">
          <div class="pure-g">
            <div class="pure-u-14-24 todown">
              <div class="inner">
                <i class="fa fa-lock" aria-hidden="true"></i>
                <span class="full-header"><?= $model->i18n("subtitle") ?></span>
                <span class="info-with-popup">
                  [?]
                  <div class="popup">
                      <?= $model->i18n("popupMessage") ?>
                  </div>
                </span>
                <span class="short-header"><?= $model->i18n("subtitle.short") ?></span>
              </div>
            </div>
            <div class="pure-u-10-24 logo">
              <a href="https://privmx.com" target="_blank">
                <img src="<?= $model->customLogo ? $model->customLogo : $model->getAsset("app/themes/default/images/logo-bl.png") ?>"/>
              </a>
            </div>
          </div>
      </div>

      <div class="content pure-u-1">


        <div class="lg-login-page">
          <div class="page-content">
            <?php if ($model->emptyPassword) { ?>
              <div class="login-info empty-password-line">
              </div>
              <div class="pure-form">
                <div class="lg-error hide">
                </div>
                <div class="button-container">
                  <button class="lg-login-btn pure-button pure-button-primary">
                    <span><?= $model->i18n("login.submit") ?></span>
                  </button>
                </div>
              </div>
            <?php } else { ?>
              <div class="login-info">
                <div class="login-info2">
                  <i class="fa fa-info-circle"></i>&nbsp;
                  <?php if ($model->hint) { ?>
                    <?= $model->i18n("login.hintInfo") ?>
                  <?php } else { ?>
                  <?= $model->i18n("login.encInfo") ?>
                  <?php } ?>
                </div>
                <?php if ($model->hint) { ?>
                <div class="pass-hint">
                  <div class="pass-hint-main">
                    <button class="pure-button pure-button-primary pure-button-small2 pass-trigger"><?= $model->i18n("login.showHint") ?></button>
                    <div class="pass-hint-content hide"><?= htmlspecialchars($model->hint) ?></div>
                  </div>
                </div>
                <?php } ?>
              </div>
              <h2><?= $model->i18n("login.header") ?></h2>
              <div class="pure-form">
                <div class="input-container">
                  <input type="password" class="lg-password" placeholder="<?= $model->i18n("login.password") ?>" />
                </div>
                <div class="lg-error hide">
                </div>
                <div class="button-container">
                  <button class="lg-login-btn pure-button pure-button-primary">
                    <span><?= $model->i18n("login.submit") ?></span>
                  </button>
                </div>
              </div>
            <?php } ?>
          </div>
          <div class="footer">
            <?= $model->i18n("footer") ?>
          </div>
        </div>



        <div class="lg-message-page hide">
          <h1 class="talk-title lg-title"></h1>
          <div class="posts lg-messages">

            <div class="load-messages lg-load-messages hide">
            </div>

            <div class="lg-new-messages">
              <div class="posts-subtitle posts-subtitle-txt">
                <i class="fa fa-envelope-o" aria-hidden="true"></i>
                <?= $model->i18n("messages.new") ?>
                <span class="post-counter post-counter-new lg-new-messages-counter">0</span>
              </div>

              <div class="lg-new-messages-list">
              </div>
            </div>

            <div class="lg-old-messages">
              <div class="posts-subtitle">
                <div class="posts-sorting pure-form">
                  <select class="pure-input-1 lg-msg-sort-type" name="sort">
                    <option value="desc" selected="selected"><?= $model->i18n("messages.sorter.fromTheNewest") ?></option>
                    <option value="asc"><?= $model->i18n("messages.sorter.fromTheOldsest") ?></option>
                  </select>
                </div>
                <div class="posts-subtitle-txt todownwrap">
                  <div class="todown">
                    <i class="fa fa-envelope-open-o" aria-hidden="true"></i>
                    <span class="section-label"><?= $model->i18n("messages.previous") ?></span>
                    <span class="post-counter lg-messages-counter">0</span>
                  </div>
                </div>
              </div>
              <div class="lg-old-messages-list">
              </div>
            </div>

          </div>
          <!-- buttony dolne --->
          <div class="pmxbuttons">
            <button class="pure-button pmxbutton lg-new-msg-btn">
              <i class="fa fa-pencil" aria-hidden="true"></i>
              <span class="normal-label"><?= $model->i18n("messages.buttons.reply") ?></span>
              <span class="continue-label"><?= $model->i18n("messages.buttons.continue") ?></span>
            </button>
            <button class="pure-button pmxbutton lg-refresh-btn">
              <i class="fa fa-refresh"></i>
            </button>
            <button class="pure-button pmxbutton lg-file-filter" disabled="disabled">
              <?= $model->i18n("messages.buttons.files") ?>
            </button>
          </div>
        </div>

        <div class="lg-new-message-page hide">
          <h1 class="talk-title lg-title"></h1>
          <div class="new-msg-info">
            <?= $model->i18n("newMessage.header") ?>
            <span class="new-msg-info-avatar">
              <img class="lg-receiver-avatar" />
            </span>
            <span class="lg-receiver-name"></span>
          </div>
          <div class="pure-form">
            <textarea class="lg-text form-control" placeholder="<?= $model->i18n("newMessage.body") ?>"></textarea>
          </div>
          <div class="lg-attachments">
          </div>
          <div class="add-attachments-container">
            <button class="pure-button pure-button-small2 lg-add-attachments-btn">
              <i class="fa fa-paperclip"></i>
              <?= $model->i18n("newMessage.buttons.addAttachment") ?>
            </button>
            <div class="max-att-info">
              <?= $model->i18n("newMessage.attachment.max") ?>
            </div>
          </div>
          <div class="lg-error hide">
          </div>
          <!-- buttony dolne --->
          <div class="pmxbuttons">
            <button class="pure-button pmxbutton lg-show-messages">
              <i class="fa fa-envelope-open-o"></i>
              <?= $model->i18n("newMessage.buttons.showMessages") ?>
            </button>
            <button class="pure-button pure-button-primary pmxbutton lg-send-btn" title="<?= $model->i18n("newMessage.buttons.send") ?>">
              <span>
                <i class="fa fa-paper-plane-o"></i>
              </span>
              <?= $model->i18n("newMessage.buttons.send") ?>
            </button>
          </div>
        </div>

      </div>
    </div>  <!-- layout -->

    <script type="view-template" id="login-dialog-template">
      <div class="alert-modal lg-login-dialog">
        <div class="alert-modal-content">
          <div class="ld-header"><?= $model->i18n("relogin.connectionLost") ?></div>
          <div class="pure-form">
            <div class="input-container">
              <input class="lg-relogin-password" placeholder="<?= $model->i18n("login.password") ?>" type="password" />
            </div>
            <div class="lg-relogin-error hide">
            </div>
          </div>
          <div class="buttons-container">
            <button class="pure-button pure-button-primary lg-relogin-btn">
              <?= $model->i18n("relogin.reconnect") ?>
            </button>
          </div>
        </div>
      </div>
    </script>

    <script type="view-template" id="msg-template">
      {{ function getIcon(mimeType) {
        var icon = "fa-file-o";
        if (mimeType.indexOf("image/") == 0) {
          icon = "fa-file-image-o";
        }
        return icon;
      } }}
      <section class="post" data-id="{{@model.id}}" data-hashmail="{{@model.hashmail}}">
        <header class="post-header pure-g">
          <div class="post-header-avatar pure-u">
            <img alt="<?= $model->i18n("messages.post.avatar") ?>" src="{{@model.avatar}}">
          </div>
          <div class="post-header-info pure-u">
            <span class="post-author">{{@model.name}}</span>
            <span class="post-address">{{@model.address}}</span>
            <span class="post-date" title="{{@Helper.dateWithHourLocal(model.date)}}">{{@model.ago}}</span>
          </div>
        </header>
          <div class="post-body">
              <div class="lg-content-toggle">
                <i class="fa fa-caret-right"></i>
                <span><?= $model->i18n("core.showContent") ?></span>
              </div>
              <div class="lg-post-content">
                {{#Helper.formatRichMessage(model.text, model.contentType)}}
              </div>
              {{ if (model.attachments.length > 0) { {{
              <div class="post-attachments pure-g">
                <div class="post-attachments-icon">
                  <i class="fa fa-paperclip fa-flip-horizontal" aria-hidden="true"></i>
                </div>
                <div class="post-attachments2">
                  {{model.attachments.forEach(function(attachment, i) { {{
                    <div class="post-attachment pure-u lg-msg-attachment" data-msg-id="{{@model.id}}" data-att-index="{{@i}}">
                      <div class="post-attachment-info lg-msg-attachment-download">
                        {{@attachment.name}}
                      </div>
                      <div class="post-attachment-size">
                        {{@Helper.bytesSize(attachment.size)}}
                      </div>
                    </div>
                  }} }); }}
                </div>
              </div>
              }} } }}
              <div class="post-quote">
                <?= $model->i18n("messages.quote") ?>
              </div>
          </div>
      </section>
    </script>

    <script type="view-template" id="msg-loading-template">
      <i class="fa fa-spin fa-circle-o-notch"></i>
    </script>

    <script type="view-template" id="attachment-template">
      <div class="lg-attachment" data-id="{{@model.id}}">
        <button class="pure-button pure-button-xsmall pure-button-error lg-attachment-delete" title="<?= $model->i18n("newMessage.deleteAttachment") ?>">
          <i class="fa fa-times text-danger"></i>
        </button>
        <div class="att-name">
          <i class="fa {{@model.icon}}"></i>
          {{@model.name}}
        </div>
      </div>
    </script>

    <script type="view-template" id="alert-template">
      <div class="alert-modal">
        <div class="alert-modal-content">
          <div class="msg">
            {{@model.message}}
          </div>
          <div class="buttons-container">
            {{(model.buttons || ["ok"]).forEach(function(btn, i) { {{
              <button class="pure-button {{@i == 0 ? 'pure-button-primary' : ''}} lg-close-alert" data-result="{{@btn}}">
                {{@Helper.i18n("alert." + btn)}}
              </button>
            }} }); }}
          </div>
        </div>
      </div>
    </script>
  </body>
</html><?php
};
