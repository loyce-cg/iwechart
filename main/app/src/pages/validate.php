<?php
return function($model) {
$model->i18nData = array(
    "pl" => array(
      "title" => "PrivMX",
      "subtitle" => "Szyfrowanie end-to-end",
      "subtitle.short" => "End-to-end",
      "success.header" => "Dziękuję",
      "success.info" => "Wiadomość została doręczona do",
      "success.info2" => "Wiadomość została doręczona",
      "error.header" => "Błąd",
      "invalid" => "Niepoprawny token",
      "popupMessage" =>  "Wszystkie dane z formularza przed wysłaniem zostaną zaszyfrowane na"
                        ." Twoim komputerze. Następnie będą przesyłane i składowane na serwerze w"
                        ." postaci nieczytelnej (nawet dla administratorów!). Odszyfrowane będą"
                        ." dopiero na komputerze odbiorcy tej wiadomości.",

    ),
    "en" => array(
      "title" => "PrivMX",
      "subtitle" => "End-to-end encryption",
      "subtitle.short" => "End-to-end",
      "success.header" => "Thank you",
      "success.info" => "Your message has been delivered to",
      "success.info2" => "Your message has been delivered",
      "error.header" => "Error",
      "invalid" => "Invalid token",
      "popupMessage" =>  "All the data placed inside this form will be encrypted on your computer, "
                        ."next - sent and stored on a server in a secure way (unreadable to anybody - even admin). "
                        ."The data will be finally decrypted on a message receiver's computer.",
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
    <style type="text/css">
      #layout {
        max-width: 600px;
      }
      .new-msg-info {
        margin-bottom: 1.2em;
        color: #444;
        margin-top: 0.2em;
      }
      .new-msg-info-avatar {
        margin-left: 0;
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
      .lg-finish-error .finish-icon {
        color: #d56401;
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
    </style>
  </head>
  <body>
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
            <a href="https://privmx.com" target="_blank">
              <img src="<?= $model->customLogo ? $model->customLogo : $model->getAsset("app/themes/default/images/logo-bl.png") ?>"/>
            </a>
          </div>
        </div>
      </div>
      <?php if ($model->result === false) { ?>
      <div class="pure-u-1 lg-finish-msg lg-finish-error">
        <div class="finish-icon">
          <i class="fa fa-times-circle"></i>
        </div>
        <div class="info-ex">
          <div class="finish-header"><?= $model->i18n("error.header") ?></div>
          <div><?= $model->i18n("invalid") ?></div>
        </div>
      </div>
      <?php } else { ?>
      <div class="pure-u-1 lg-finish-msg lg-finish-success">
        <div class="finish-icon">
          <i class="fa fa-check-circle"></i>
        </div>
        <div class="info-ex">
          <div class="finish-header"><?= $model->i18n("success.header") ?></div>
          <?php if ($model->displayType == "user") { ?>
            <div><?= $model->i18n("success.info") ?></div>
            <div>
              <span class="new-msg-info-avatar">
                <img class="lg-receiver-avatar" src="<?= $model->userInfo["imgUrl"] ? $model->userInfo["imgUrl"] : $model->getAsset("app/icons/user-default.png") ?>" />
              </span>
              <span class="lg-receiver-name">
                <?= $model->userInfo["displayName"] ? "<b>" . htmlspecialchars($model->userInfo["displayName"]) . "</b> <span class='hashmail'>&lt;" . $model->userInfo["hashmail"] . "&gt;</span>" : $model->userInfo["hashmail"] ?>
              </span>
            </div>
          <?php } else { ?>
            <div><?= $model->i18n("success.info2") ?></div>
          <?php } ?>
        </div>
      </div>
      <?php } ?>
    </div>
    <script type="text/javascript" src="app/build/privmx-view-lite.js"></script>
    <script>
        var ViewLite = privmxViewLiteRequire("privmx-view-lite");
        var $ = ViewLite.$;
        $(document).ready(function(){
            $("body").on("click", function(e) {
                $(".info-with-popup").removeClass("opened");
            });
            $(".info-with-popup").click(function(e) {
              $(e.target).closest(".info-with-popup").toggleClass("opened");
              return false;
            });
        });
    </script>
  </body>
 </html><?php
 };
