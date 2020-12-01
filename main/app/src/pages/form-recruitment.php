<?php
return function($model) {
$name = "Simplito";
$fullName = "Simplito sp. z o.o.";
$fullNameWithPlace = "Simplito sp. z o.o. z siedzibą w Toruniu";
$rodoEmail = "office@simplito.com";
$rodoStorage = "OVH Sp. z o.o.";
$url = "https://simplito.com";
$model->i18nData = array(
    "pl" => array(
      "title" => "Formularz rekrutacyjny $fullName",
      "subtitle" => "Szyfrowanie end-to-end",
      "subtitle.short" => "End-to-end",
      "popupMessage" =>  "Wszystkie dane z formularza przed wysłaniem zostaną zaszyfrowane na "
                        ."Twoim komputerze. Następnie będą przesyłane i składowane na serwerze w "
                        ."postaci nieczytelnej (nawet dla administratorów!). Odszyfrowane będą "
                        ."dopiero na komputerze osoby prowadzącej rekrutację w $name.",
      "alert.ok" => "OK",
      "sending" => "Wysyłanie...",
      "header" => "Formularz rekrutacyjny",
      "info" => "Dziękujemy za zainteresowanie współpracą z zespołem $name. Prosimy o przesłanie kilku podstawowych informacji o sobie. Uprzejmie informujemy, iż kontaktujemy się tylko z wybranymi osobami.",
      "form.sender_name" => "Imię i nazwisko",
      "form.subject" => "Tytuł wiadomości",
      "form.body" => "Twoja wiadomość...",
      "form.cv" => "Prosimy o załączenie CV.",
      "form.cv2" => "Z przyjemnością zapoznamy się również z innymi plikami, które tutaj załączysz.",
      "form.attachments" => "Załączniki",
      "form.attachments.add" => "Dodaj załącznik",
      "form.attachments.delete" => "Usuń",
      "form.attachments.max" => "max 20 MB",
      "form.attachments.required" => "Proszę dodać załącznik",
      "form.email" => "Adres email",
      "form.email.info1" => "Otrzymasz email z linkiem weryfikacyjnym do kliknięcia.",
      "form.email.info2" => "Na podany adres będą wysyłane powiadomienia o odpowiedzi.",
      "form.password" => "Ustal wspólne hasło do rozmowy",
      "form.password.info" => "Hasło jest wymagane, aby zabezpieczyć komunikację end-to-end. Zapamiętaj je. To hasło zostanie bezpiecznie dostarczone do odbiorcy.",
      "form.password.show" => "Pokaż hasło",
      "form.password.hide" => "Ukryj hasło",
      "form.position" => "Stanowisko, na które aplikujesz",
      "form.send" => "Wyślij",
      "acceptance.personal_data" => "Wyrażam zgodę na przetwarzanie danych osobowych zawartych w mojej ofercie pracy dla potrzeb niezbędnych do realizacji procesu rekrutacji prowadzonego przez $fullNameWithPlace zgodnie z ustawą z dnia 29 sierpnia 1997 r. o ochronie danych osobowych (t.j. Dz. U. z 2016 r., poz. 922).",
      "rodo1" => "Informacja nt. przetwarzania danych osobowych",
      "rodo2" => "W każdym czasie możesz cofnąć swoją zgodę na przetwarzanie, kontaktując się z nami pod adresem $rodoEmail.  Cofnięcie zgody pozostaje bez wpływu na zgodność z prawem przetwarzania, którego dokonanaliśmy przed cofnięciem zgody. Masz prawo dostępu do swoich danych, w tym uzyskania ich kopii, sprostowania danych, żądania ich usunięcia, ograniczenia przetwarzania, wniesienia sprzeciwu wobec przetwarzania oraz przeniesienia podanych danych (na których przetwarzanie wyraziłeś zgodę) do innego administratora danych. Masz także prawo do wniesienia skargi do Generalnego Inspektora Ochrony Danych Osobowych. Twoje dane osobowe zawarte w CV są przetwarzane w oparciu o przepisy prawa. Przesłanie CV jest konieczne do wzięcia udziału w rekrutacji. Pozostałe pliki załączasz na podstawie Twojej dobrowolnej woli i zgody - wyrażasz ją wysyłając nam swoje zgłoszenie rekrutacyjne powyższym formularzem. Twoje dane osobowe szyfrowane są na Twoim komputerze przed wysłaniem na nasz serwer, są w związku z tym przechowywane w postaci nieczytelnej dla osób i urządzeń postronnych. W tej nieczytelnej postaci przetwarzane (przechowywane) są w datacenter należącym do $rodoStorage Twoje dane odszyfrowywane są jedynie na komputerach osób prowadzących rekrutację w $name. Nie przekazujemy Twoich danych osobowych poza Europejski Obszar Gospodarczy. Możesz się z nami skontaktować pod adresem e-mail $rodoEmail.",
      "error" => "Błąd podczas wysyłania wiadomości",
      "error.missingPrivmx" => "Nie znaleziono PrivMX!",
      "success.header" => "Dziękujemy",
      "success.info" => "Twoje dane zostały zaszyfrowane i przesłane do $name",
      "success.verify" => "Sprawdź skrzynkę {0} i kliknij link potwierdzający, aby dostarczyć wiadomość.",
      "login.info" => "Jeżeli masz już konto w PrivMX",
      "login.button" => "Zaloguj się",
      "message.subject" => "Kandydat"
    ),
    "en" => array(
      "title" => "Recruitment form $fullName",
      "subtitle" => "End-to-end encryption",
      "subtitle.short" => "End-to-end",
      "popupMessage" =>  "All the data placed inside this form will be encrypted on your computer, "
                        ."next - sent and stored on a server in a secure way (unreadable to anybody - even admin). "
                        ."The data will be finally decrypted on $name recruiter's computer.",
      "alert.ok" => "OK",
      "sending" => "Sending...",
      "header" => "Recruitment form",
      "info" => "[EN] Dziękujemy za zainteresowanie współpracą z zespołem $name. Prosimy o przesłanie kilku podstawowych informacji o sobie. Uprzejmie informujemy, iż kontaktujemy się tylko z wybranymi osobami.",
      "form.sender_name" => "First and last name",
      "form.subject" => "Message subject",
      "form.body" => "Your message...",
      "form.cv" => "[EN] Prosimy o załączenie CV.",
      "form.cv2" => "[EN] Z przyjemnością zapoznamy się również z innymi plikami, które tutaj załączysz.",
      "form.attachments" => "Attachments",
      "form.attachments.add" => "Add attachment",
      "form.attachments.delete" => "Delete",
      "form.attachments.max" => "max 20 MB",
      "form.attachments.required" => "[EN] Proszę dodać załącznik",
      "form.email" => "Your email address",
      "form.email.info1" => "You will receive an email with a verification link to click.",
      "form.email.info2" => "Notifications about replay will be send at given email address.",
      "form.password" => "Set a shared password for a conversation",
      "form.password.info" => "Password is required to end-to-end secure the communication. Remember it. This password will be securely delivered to receiver.",
      "form.password.show" => "Show password",
      "form.password.hide" => "Hide password",
      "form.position" => "[EN] Stanowisko, na które aplikujesz",
      "form.send" => "Send",
      "error" => "Error during sending a message",
      "error.missingPrivmx" => "PrivMX not found!",
      "success.header" => "Thank you",
      "success.info" => "Your data has been encrypted and delivered to $name.",
      "success.verify" => "Please check the {0} mailbox and click confirmation link to deliver the message.",
      "login.info" => "If you already have PrivMX account",
      "login.button" => "Login",
      "message.subject" => "Candidate"
    )
);
$model->lang = "pl";
?><!DOCTYPE html>
<html lang="<?= $model->lang ?>">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="cache-control" content="public, no-cache" />
    <link href="<?= $model->getAsset("app/pages-assets/pure-release-1.0.0/pure-min.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/pages-assets/pure-release-1.0.0/grids-responsive-min.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/pages-assets/pmxtalk.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/themes/default/css/fonts.css") ?>" media="all" rel="stylesheet" />
    <link href="<?= $model->getAsset("app/themes/default/css/font-awesome.min.css") ?>" media="all" rel="stylesheet" />
    <link rel="shortcut icon" href="favicon.ico" />
    <title><?= $model->i18n("title") ?></title>
    <style type="text/css">
      h2 {
        margin: 0;
      }
      label {
        font-weight: bold;
      }
      input, textarea {
        width: 100%;
      }
      textarea {
        height: 10em;
      }
      #loading {
        text-align: center;
        font-size: 16px;
      }
      #loading .alert-modal-content {
        padding-bottom: 30px;
      }

      .header .todown {
          color: #b9b9b9;
      }

      .form-group {
        margin-bottom: 10px;
      }
      .main-container {
        padding-bottom: 50px;
      }
      .info {
        font-size: 14px;
        color: #999;
      }
      #layout {
        max-width: 800px;
      }
      .new-msg-info {
        margin-bottom: 1.2em;
        color: #444;
        margin-top: 0.2em;
      }
      .new-msg-info-avatar {
        margin-left: 0;
      }
      .form-sub-section {
        margin-top: 20px;
      }
      .pure-form .main-btn-conatiner button[type=submit] {
        margin-top: 20px;
      }
      @media (min-width: 380px) {
        .aligned-form {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        .aligned-form .aligned-label {
          float: left;
          width: 150px;
          display: table;
          text-align: right;
        }
        .aligned-form .aligned-label label {
          vertical-align: middle;
          height: 36px;
          display: table-cell;
        }
        .aligned-form .aligned-value {
          margin-left: 160px;
          display: block;
        }
        .main-btn-conatiner {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        .pure-form .main-btn-conatiner button[type=submit] {
          margin-top: 0;
        }
        .pure-control-group {
          margin-bottom: 10px;
        }
      }
      .finish-icon {
        margin: 20px 0 10px 0;
        text-align: center;
        font-size: 40px;
        opacity: 0.3;
      }
      .lg-finish-verify .finish-icon {
        color: #999;
      }
      .lg-finish-success .finish-icon {
        color: #60ae1c;
      }
      .info-ex {
        font-size: 16px;
        text-align: center;
        padding: 0 20px;
      }
      .finish-header {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .password-info b,
      .password-info .hashmail {
        font-weight: bold;
      }
      .lg-add-attachments-btn {
        position: relative;
      }
      .popup {
        position: absolute;
        top: 38px;
        left: -12px;
        padding: 12px 15px 12px 15px;
        border: 1px solid #999;
        box-shadow: 0px 0px 2px 2px #ddd;
        background-color: #fff;
        color: #000;
        z-index: 1;
      }
      .popup:before {
        border: 9px solid transparent;
        content: " ";
        position: absolute;
        top: -18px;
        left: 5px;
        width: 0;
        height: 0;
        border-bottom-color: #999;
      }
      .popup:after {
        border: 9px solid transparent;
        content: " ";
        position: absolute;
        top: -17px;
        left: 5px;
        width: 0;
        height: 0;
        border-bottom-color: #FFF;
      }
      .error-popup {
        display: none;
      }
      .show-error .error-popup {
        display: block;
      }
      .info-with-popup {
        cursor: pointer;
        position: relative;
        margin-left: 3px;
      }
      .info-with-popup .popup {
        display: none;
        top: 28px;
        width: 275px;
        margin-left: -95px;
        line-height: 1.2;
        text-align: left;
        cursor: default;
        font-family: source_sans_pro, arial, sans-serif;
      }
      .info-with-popup .popup:before {
        left: 104px;
      }
      .info-with-popup .popup:after {
        left: 104px;
      }
      .info-with-popup.opened .popup {
        display: block;
      }
      .verif-msg {
        color: #999;
        display: inline;
        padding-left: 10px;
      }
      @media (min-width: 350px) {
        .header .full-header {
          display: none;
        }
        .header .short-header {
          display: inline;
        }
      }
      @media (min-width: 380px) {
        .header .full-header {
          display: inline;
        }
        .header .short-header {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="alert-modal hide" id="alert">
      <div class="alert-modal-content">
        <div class="msg" id="alert-message">
        </div>
        <div class="buttons-container">
          <button class="pure-button pure-button-primary lg-close-alert" id="alert-close-btn">
            <?= $model->i18n("alert.ok") ?>
          </button>
        </div>
      </div>
    </div>
    <div class="alert-modal hide" id="loading">
      <div class="alert-modal-content">
        <div class="msg">
          <?= $model->i18n("sending") ?>
        </div>
      </div>
    </div>
    <div id="layout" class="pure-g pmxlayout">
      <div class="header pure-u-1">
        <div class="pure-g">
          <div class="pure-u-14-24 todown">
            <div class="inner">
              <i class="fa fa-lock" aria-hidden="true"></i>
              <span class="full-header"><?= $model->i18n("subtitle") ?></span>
              <span class="short-header"><?= $model->i18n("subtitle.short") ?></span>
              <span class="info-with-popup">
                [?]
                <div class="popup">
                  <?= $model->i18n("popupMessage") ?>
                </div>
              </span>
            </div>
          </div>
          <div class="pure-u-10-24 logo">
            <a href="$url" target="_blank" alt="$name">
              <img src="<?= $model->customLogo ? $model->customLogo : $model->getAsset("app/themes/default/images/logo-bl.png") ?>"/>
            </a>
          </div>
        </div>
      </div>
      <?php if ($model->emailVerification) { ?>
        <div class="pure-u-1 lg-finish-msg lg-finish-verify hide">
          <div class="finish-icon">
            <i class="fa fa-clock-o"></i>
          </div>
          <div class="info-ex">
          </div>
        </div>
      <?php } else { ?>
        <div class="pure-u-1 lg-finish-msg lg-finish-success hide">
          <div class="finish-icon">
            <i class="fa fa-check-circle"></i>
          </div>
          <div class="info-ex">
            <div class="finish-header"><?= $model->i18n("success.header") ?></div>
            <div><?= $model->i18n("success.info") ?></div>
          </div>
        </div>
      <?php } ?>
      <div class="pure-u-1 lg-form">
        <div class="container main-container">
          <h2><?= $model->i18n("header") ?></h2>

          <p>
            <?= $model->i18n("info") ?>
          </p>

          <div class="new-msg-info">
          </div>

          <form name="contact" class="pure-form" autocomplete="off">

            <div class="main-btn-conatiner">

            <div class="form-group">
              <input type="text" name="name" required="required" placeholder="<?= $model->i18n("form.sender_name") ?>" />
            </div>

            <div class="pure-control-group">
                <div class="aligned-value">
                  <input type="email" name="email" required="required" autocomplete="off" placeholder="<?= $model->i18n("form.email") ?>" />
                </div>
            </div>

            <div class="form-group">
              <input type="text" name="position" required="required" placeholder="<?= $model->i18n("form.position") ?>" />
            </div>

          </div>

            <div class="main-btn-conatiner">

            <p style="font-size:100%"><?= $model->i18n("form.cv") ?> <br/><?= $model->i18n("form.cv2") ?></p>

              <div class="lg-attachments">
              </div>
              <div class="add-attachments-container">
                <button type="button" class="pure-button pure-button-small2 lg-add-attachments-btn">
                  <i class="fa fa-paperclip"></i>&nbsp; <?= $model->i18n("form.attachments.add") ?>
                  <div class="error-popup popup">
                    <?= $model->i18n("form.attachments.required") ?>
                  </div>
                </button>
                <div class="max-att-info">
                  <?= $model->i18n("form.attachments.max") ?>
                </div>
              </div>

          </div>

            <div class="main-btn-conatiner">
              <p>
              <label for="cb" class="pure-checkbox" style="line-height:100%;">
                <input id="cb" type="checkbox" style="display:inline;width:20px;" required>
                <span style="font-size:80%;font-weight:normal;">
                  <?= $model->i18n("acceptance.personal_data") ?>
                </span>
              </label>
            </p>
              <button id="form-submit" type="button" class="pure-button pure-button-primary">
                <i class="fa fa-paper-plane-o"></i>&nbsp;
                <?= $model->i18n("form.send") ?>
              </button>
              <button type="submit" id="real-submit" class="hide"></button>
              <?php if ($model->emailVerification) { ?>
                <span class="verif-msg"> <?= $model->i18n("form.email.info1") ?></span>
              <?php } ?>
            </div>
          </form>
          <p style="margin-top:25px;font-size:80%; color:#797979;">
            <b><?= $model->i18n("rodo1") ?></b><br/>
            <?= $model->i18n("rodo2") ?>
          </p>
          <?php if ($model->showLogin) { ?>
          <div class="login-section pure-u-1">
            <!-- <div class="login-info">
              <?= $model->i18n("login.info") ?>
            </div> -->
            <a href="<?= $model->loginUrl ?>">
              <?= $model->i18n("login.button") ?>
            </a>
          </div>
          <?php } ?>
        </div>
      </div>
    </div>
    <script type="view-template" id="attachment-template">
      <div class="lg-attachment" data-id="{{@model.id}}">
        <button class="pure-button pure-button-xsmall pure-button-error lg-attachment-delete" title="<?= $model->i18n("form.attachments.delete") ?>">
          <i class="fa fa-times text-danger"></i>
        </button>
        <div class="att-name">
          <i class="fa {{@model.icon}}"></i>
          {{@model.name}}
        </div>
      </div>
    </script>
    <script type="text/javascript" src="<?= $model->getAsset("server/secure-form/assets.php?f=privmx-client") ?>"></script>
    <script type="text/javascript" src="<?= $model->getAsset("app/build/privmx-view-lite.js") ?>"></script>
    <script type="text/javascript">
      var LANG = "<?= $model->lang ?>";
      var I18N_DATA = {
<?php
foreach ($model->i18nData[$model->lang] as $key => $value) {
echo("        \"$key\": \"$value\",\n");
}
?>
      };
      var ViewLite = privmxViewLiteRequire("privmx-view-lite");
      var $ = ViewLite.$;
      $(document).ready(function() {
        function i18n(id) {
            return id in I18N_DATA ? I18N_DATA[id] : id;
        }
        var manager = new ViewLite.TemplateManager();
        manager.helper = new ViewLite.ViewHelper(this.manager);
        manager.helper.i18n = i18n;
        var attachmentTemplate = manager.createTemplateFromHtmlElement($("#attachment-template"));
        var attachments = {};
        var attachmentId = 0;
        function openFiles(cb) {
          var $input = $('<input type="file" multiple="multiple" style="height:0;width:1px;display:block;margin:0;"/>');
          $input.on("change", function(event) {
            let files = event.target.files;
            if (files.length) {
              cb(files);
            }
            $input.remove();
          });
          $("body").append($input);
          $input.trigger("click");
        }
        var errorRemovable = false;
        $("body").click(function() {
          if (errorRemovable) {
            $(".lg-add-attachments-btn").removeClass("show-error");
            errorRemovable = false;
          }
          $(".info-with-popup").removeClass("opened");
        });
        $(".info-with-popup").click(function(e) {
          $(e.target).closest(".info-with-popup").toggleClass("opened");
          return false;
        });
        $(".lg-add-attachments-btn").click(function() {
          openFiles(function(files) {
            var $container = $(".lg-attachments");
            for (var i = 0; i < files.length; i++) {
              var x = files[i];
              var id = attachmentId++;
              attachments[id] = x;
              $container.append(attachmentTemplate.renderToJQ({
                id: id,
                name: x.name,
                icon: x.type.indexOf("image/") == 0 ? "fa-file-image-o" : "fa-file-o"
              }));
            }
          });
        });
        $("body").on("click", ".lg-attachment-delete", function(e) {
          var $attachment = $(e.target).closest(".lg-attachment");
          var id = $attachment.data("id");
          delete attachments[id];
          $attachment.remove();
        });
        var loading = document.getElementById("loading");
        function showAlert(msg) {
          document.getElementById("alert").classList.remove("hide");
          document.getElementById("alert-message").innerHTML = msg;
        }

        document.getElementById("alert-close-btn").addEventListener("click", function() {
          document.getElementById("alert").classList.add("hide");
        });
        document.forms.contact.addEventListener("submit", function (event) {
          event.preventDefault();
          return false;
        });

        function formSubmit($form) {

          var $password = $("form").find("input[type=password]");
          var password = $password.val();
          $password.css("position", "absolute");
          $password.css("left", "-9999px");
          var $fakePass = $("<input type='password' disabled='disabled' />");
          $fakePass.val(password);
          $fakePass.insertBefore($password);

          var $inputs = $("form").find("button, input:not([type=password]), textarea");

          var $submit = $("#form-submit");
          var sending = true;
          $submit.find("i").attr("class", "fa fa-spin fa-circle-o-notch");
          $inputs.prop("disabled", true);

          return function() {
              $submit.find("i").attr("class", "fa fa-paper-plane-o");
              $inputs.prop("disabled", false);
              $fakePass.remove();
              $password.css("position", "static");
          };
        }

        $("#form-submit").on("click", function() {
          var valid = true;
          $("textarea, input").each(function(i, e) {
            if (!e.checkValidity()) {
              $("#real-submit").click();
              valid = false;
              return false;
            }
          });
          if (!valid) {
            return;
          }
          if (!window.privmx) {
            showAlert("<?= $model->i18n("error.missingPrivmx") ?>");
            return false;
          }


          var contactForm = document.forms.contact;
          var formData = window.privmx.collectFormData(contactForm);
          var files = Object.keys(attachments).map(function(key) { return attachments[key]; });
          if (files.length == 0) {
              $(".lg-add-attachments-btn").addClass("show-error");
              errorRemovable = false;
              setTimeout(function() {
                errorRemovable = true;
              }, 100);
              return;
          }
          var email = contactForm.email.value;
          formData.fields.language = "pl";
          var restoreForm = formSubmit($(contactForm));
          
          window.privmx.send({
            host: location.hostname,
            sid: "<?= $model->sid ?>",
            data: formData.fields,
            files: files,
            subject: "<?= $model->i18n("message.subject") ?>",
            extra: JSON.stringify({email: contactForm.email.value, lang: "pl"}),
            onSuccess: function() {
              setTimeout(function() {
                $(".lg-finish-msg.lg-finish-verify .info-ex").html("<?= $model->i18n("success.verify") ?>".replace("{0}", "<b>" + manager.helper.escapeHtml(email) + "</b>"));
                $(".lg-finish-msg").removeClass("hide");
                $(".lg-form").addClass("hide");
              }, 1);
            },

            onError: function(e) {
              console.log("Error", e);
              if ("transferId" in e && e.couse) {
                e = e.couse;
              }
              var msg = "";
              if (e && e.message) {
                msg = e.message;
              }
              else if (e && e.msg) {
                msg = e.msg;
              }
              var code = null;
              if (e && e.data && e.data.error && e.data.error.code) {
                code = e.data.error.code;
              }
              if (e && e.errorObject && e.errorObject.code) {
                code = e.errorObject.code;
              }
              if (code != null) {
                msg = (typeof(code) == "number" ? "0x" + code.toString(16) : code) + (msg ? ": " + msg : "");
              }
              restoreForm();
              showAlert("<?= $model->i18n("error") ?>" + (msg ? " (" + msg + ")": ""));
            }

          });
          return false;
        });
      });
    </script>
  </body>
</html><?php
};