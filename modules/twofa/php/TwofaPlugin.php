<?php

namespace io\privfs\plugin\twofa;

use io\privfs\config\Config;
use io\privfs\core\Utils;
use io\privfs\data\Plugin;

global $_PRIVMX_GLOBALS;
require_once(Utils::joinPaths($_PRIVMX_GLOBALS["pluginsDir"], "twofa/server/lib/GoogleAuthenticator/PHPGangsta/GoogleAuthenticator.php"));

class TwofaPlugin extends Plugin {
    
    public $ioc;
    public $config;
    public $validators;
    public $twofaService;
    public $session;
    
    public function __construct($ioc) {
        global $_PRIVMX_GLOBALS;
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_NOT_ENABLED"] = array("code" => 0x7001, "message" => "2FA not enabled for user");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_INVALID_TYPE"] = array("code" => 0x7002, "message" => "Invlaid 2FA type");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_CODE_ALREADY_RESEND"] = array("code" => 0x7003, "message" => "Code already resend");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_INVALID_GOOLGE_AUTHENTICATOR_SECRET"] = array("code" => 0x7004, "message" => "Invalid Google Authenticator secret");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_EMAIL_REQUIRED"] = array("code" => 0x7005, "message" => "Field email is required");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_MOBILE_REQUIRED"] = array("code" => 0x7006, "message" => "Field mobile is required");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_INVALID_CODE"] = array("code" => 0x7007, "message" => "Invalid code");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_VERIFICATION_FAILED"] = array("code" => 0x7008, "message" => "Verification failed");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_INVALID_SESSION"] = array("code" => 0x7009, "message" => "Invalid 2FA session");
        $_PRIVMX_GLOBALS["error_codes"]["TWOFA_CANNOT_SEND_CODE"] = array("code" => 0x7010, "message" => "Cannot send code");
        
        $this->ioc = $ioc;
        $this->config = $this->ioc->getConfig();
        $this->config->setOptionalVariable("twofaMethods", array("googleAuthenticator", "email", "sms"));
        $this->config->setOptionalVariable("twofaMaxAttemptsCount", 3);
        $this->validators = new Validators($ioc->getValidators());
        $this->twofaService = new TwofaService(
            $this->ioc->getUser(),
            $this->ioc->getConfig(),
            $this->ioc->getMailService(),
            $this->ioc->getSessionHolder(),
            $this->ioc->getSmsService(),
            $this->ioc->getDeviceToken()
        );
        
        register_privmx_callback("additionalLoginStep", array($this, "additionalLoginStep"));
        
        $this->callbacks = $this->ioc->getCallbacks();
    }
    
    public function registerEndpoint(\io\privfs\protocol\ServerEndpoint $server) {
        $server->bind($this, "getData", array(
            "name" => "twofaGetData",
            "validator" => $this->validators->get("getData"),
            "permissions" => $server::BASIC_PERMISSIONS,
            "withSession" => true
        ));
        $server->bind($this, "disable", array(
            "name" => "twofaDisable",
            "validator" => $this->validators->get("disable"),
            "permissions" => $server::BASIC_PERMISSIONS,
            "withSession" => true
        ));
        $server->bind($this, "enable", array(
            "name" => "twofaEnable",
            "validator" => $this->validators->get("enable"),
            "permissions" => $server::BASIC_PERMISSIONS,
            "withSession" => true
        ));
        $server->bind($this, "challenge", array(
            "name" => "twofaChallenge",
            "validator" => $this->validators->get("challenge"),
            "permissions" => array($server::SESSION_ADDITIONAL_LOGIN_STEP, $server::BASIC_PERMISSIONS),
            "withSession" => true
        ));
        $server->bind($this, "resendCode", array(
            "name" => "twofaResendCode",
            "validator" => $this->validators->get("resendCode"),
            "permissions" => array($server::SESSION_ADDITIONAL_LOGIN_STEP, $server::BASIC_PERMISSIONS),
            "withSession" => true
        ));
    }
    
    public function processEvent($event) {
    }
    
    public function getName() {
        return "twofa";
    }
    
    public function setSession($session) {
        $this->session = $session;
    }
    
    public function additionalLoginStep($session) {
        return $this->twofaService->additionalLoginStep($session);
    }
    
    //======================================================================
    
    public function getData() {
        return $this->twofaService->getData($this->session->get("username"));
    }
    
    public function disable() {
        return $this->twofaService->disable($this->session->get("username"));
    }
    
    public function enable($data) {
        return $this->twofaService->enable($this->session, $data);
    }
    
    public function challenge($code, $rememberDeviceId = true) {
        return $this->twofaService->challenge($this->session, $code, $rememberDeviceId);
    }
    
    public function resendCode() {
        return $this->twofaService->resendCode($this->session);
    }
}