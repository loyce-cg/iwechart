<?php

namespace io\privfs\plugin\twofa;

use io\privfs\config\Config;
use io\privfs\core\JsonRpcException;
use io\privfs\core\MailService;
use io\privfs\core\SmsService;
use io\privfs\data\SessionHolder;
use io\privfs\data\DeviceToken;
use io\privfs\data\User;

class TwofaService {
    
    const SESSION_KEY = "twofaplugin";
    const USER_DATA_KEY = "twofa";
    const MAX_ATTEMPTS_COUNT = 3;
    
    public static $templates;
    private $userService;
    private $config;
    private $mailService;
    private $sessionHolder;
    private $smsService;
    private $deviceToken;
    
    public function __construct(User $userService, Config $config, MailService $mailService, SessionHolder $sessionHolder,
        SmsService $smsService, DeviceToken $deviceToken) {
        
        $this->userService = $userService;
        $this->config = $config;
        $this->mailService = $mailService;
        $this->sessionHolder = $sessionHolder;
        $this->smsService = $smsService;
        $this->deviceToken = $deviceToken;
        $this->logger = \io\privfs\log\LoggerFactory::get($this);
    }
    
    public function getData($username) {
        $smsEnabled = $this->smsService->isEnabled();
        return array(
            "data" => $this->userService->getPluginData($username, TwofaService::USER_DATA_KEY),
            "methods" => array_filter($this->config->twofaMethods, function($method) use($smsEnabled) {
                return $method != "sms" || $smsEnabled;
            })
        );
    }
    
    public function disable($username) {
        $data = $this->userService->getPluginData($username, TwofaService::USER_DATA_KEY);
        if ($data === null) {
            return "OK";
        }
        $data["enabled"] = false;
        unset($data["allowed"]);
        return $this->userService->setPluginData($username, "twofa", $data);
    }
    
    public function enable($session, $data) {
        $username = $session->get("username");
        $data["enabled"] = true;
        $sessionData = array(
            "mode" => "setData",
            "type" => $data["type"],
            "attempts" => $this->config->twofaMaxAttemptsCount,
            "data" => $data
        );
        if ($data["type"] == "googleAuthenticator") {
            $ga = new \PHPGangsta_GoogleAuthenticator();
            if (!$ga->checkSecret($data["googleAuthenticatorKey"])) {
                throw new JsonRpcException("TWOFA_INVALID_GOOLGE_AUTHENTICATOR_SECRET");
            }
            $sessionData["googleAuthenticatorKey"] = $data["googleAuthenticatorKey"];
        }
        else if ($data["type"] == "email") {
            if (!$data["email"]) {
                throw new JsonRpcException("TWOFA_EMAIL_REQUIRED");
            }
            $sessionData["email"] = $data["email"];
            $sessionData["code"] = $this->generateCode();
            if (!$this->sendEmailWithCode($username, $sessionData["email"], $sessionData["code"])) {
                throw new JsonRpcException("TWOFA_CANNOT_SEND_CODE");
            }
        }
        else if ($data["type"] == "sms") {
            if (!$data["mobile"]) {
                throw new JsonRpcException("TWOFA_MOBILE_REQUIRED");
            }
            $sessionData["mobile"] = $data["mobile"];
            $sessionData["code"] = $this->generateCode();
            if (!$this->sendSmsWithCode($username, $sessionData["mobile"], $sessionData["code"])) {
                throw new JsonRpcException("TWOFA_CANNOT_SEND_CODE");
            }
        }
        else {
            throw new \io\privfs\core\JsonRpcException("TWOFA_INVALID_SESSION", "Unsupported 2FA type " . $data["type"]);
        }
        $session->set(TwofaService::SESSION_KEY, $sessionData);
        return array(
            "attempts" => $sessionData["attempts"]
        );
    }
    
    public function generateCode() {
        return str_pad(strval(rand(0, 9999)), 4, "0", STR_PAD_LEFT);
    }
    
    public function additionalLoginStep($session) {
        $username = $session->get("username");
        $data = $this->userService->getPluginData($username, TwofaService::USER_DATA_KEY);
        if (!$data || !$data["enabled"]) {
            return false;
        }
        $props = $session->get("properties");
        $deviceId = $props && isset($props["deviceId"]) ? $props["deviceId"] : null;
        if ($deviceId && isset($data["allowed"]) && in_array($deviceId, $data["allowed"])) {
            return false;
        }
        $deviceToken = $props && isset($props["deviceToken"]) ? $props["deviceToken"] : null;
        if ($deviceToken && $this->deviceToken->checkToken($deviceToken, $deviceId)) {
            return false;
        }
        $sessionData = array(
            "mode" => "login",
            "type" => $data["type"],
            "attempts" => $this->config->twofaMaxAttemptsCount
        );
        $result = array(
            "reason" => "twofa",
            "type" => $sessionData["type"],
            "attempts" => $sessionData["attempts"]
        );
        if ($data["type"] == "googleAuthenticator") {
            $sessionData["googleAuthenticatorKey"] = $data["googleAuthenticatorKey"];
        }
        else if ($data["type"] == "sms") {
            $sessionData["mobile"] = $data["mobile"];
            $sessionData["code"] = $this->generateCode();
            if (!$this->sendSmsWithCode($username, $sessionData["mobile"], $sessionData["code"])) {
                return false;
            }
            $result["mobile"] = $sessionData["mobile"];
        }
        else if ($data["type"] == "email") {
            $sessionData["email"] = $data["email"];
            $sessionData["code"] = $this->generateCode();
            if (!$this->sendEmailWithCode($username, $sessionData["email"], $sessionData["code"])) {
                return false;
            }
            $result["email"] = $sessionData["email"];
        }
        else {
            return false;
        }
        $session->set("state", "additionalLoginStep");
        $session->set(TwofaService::SESSION_KEY, $sessionData);
        return $result;
    }
    
    public function challenge($session, $code, $rememberDeviceId = true) {
        $sessionData = $session->get(TwofaService::SESSION_KEY);
        if ($sessionData === null) {
            throw new \io\privfs\core\JsonRpcException("TWOFA_INVALID_SESSION");
        }
        if ($sessionData["attempts"] <= 0) {
            if ($sessionData["mode"] == "login") {
                $session->set("state", "failed");
            }
            $session->set(TwofaService::SESSION_KEY, null);
            throw new \io\privfs\core\JsonRpcException("TWOFA_VERIFICATION_FAILED");
        }
        $valid = false;
        if ($sessionData["type"] == "googleAuthenticator") {
            $ga = new \PHPGangsta_GoogleAuthenticator();
            if ($ga->verifyCode($sessionData["googleAuthenticatorKey"], $code)) {
                $valid = true;
            }
        }
        else if ($sessionData["type"] == "email" || $sessionData["type"] == "sms") {
            if ($code == $sessionData["code"]) {
                $valid = true;
            }
        }
        else {
            if ($sessionData["mode"] == "login") {
                $session->set("state", "failed");
            }
            $session->set(TwofaService::SESSION_KEY, null);
            throw new \io\privfs\core\JsonRpcException("TWOFA_INVALID_SESSION", "Unsupported 2FA type " . $sessionData["type"]);
        }
        if ($valid) {
            if ($sessionData["mode"] == "login") {
                $session->set("state", "exchange");
                $props = $session->get("properties");
                $deviceId = $props && isset($props["deviceId"]) ? $props["deviceId"] : null;
                if ($rememberDeviceId && $deviceId) {
                    $this->userService->setPluginDataFunc($session->get("username"), TwofaService::USER_DATA_KEY, function($data) use($deviceId) {
                        $data = $data ? $data : array();
                        $allowed = isset($data["allowed"]) ? $data["allowed"] : array();
                        if (!in_array($deviceId, $allowed)) {
                            array_push($allowed, $deviceId);
                        }
                        $data["allowed"] = $allowed;
                        return $data;
                    });
                }
            }
            else if ($sessionData["mode"] == "setData") {
                $props = $session->get("properties");
                $deviceId = $props && isset($props["deviceId"]) ? $props["deviceId"] : null;
                if ($rememberDeviceId && $deviceId) {
                    $allowed = isset($sessionData["data"]["allowed"]) ? $sessionData["data"]["allowed"] : array();
                    if (!in_array($deviceId, $allowed)) {
                        array_push($allowed, $deviceId);
                    }
                    $sessionData["data"]["allowed"] = $allowed;
                }
                $this->userService->setPluginData($session->get("username"), TwofaService::USER_DATA_KEY, $sessionData["data"]);
            }
            $session->set(TwofaService::SESSION_KEY, null);
        }
        else {
            $sessionData["attempts"]--;
            $session->set(TwofaService::SESSION_KEY, $sessionData);
            if ($sessionData["attempts"] <= 0) {
                if ($sessionData["mode"] == "login") {
                    $session->set("state", "failed");
                }
                $session->set(TwofaService::SESSION_KEY, null);
                throw new \io\privfs\core\JsonRpcException("TWOFA_VERIFICATION_FAILED");
            }
            else {
                throw new \io\privfs\core\JsonRpcException("TWOFA_INVALID_CODE", $sessionData["attempts"]);
            }
        }
        return "OK";
    }
    
    public function resendCode($session) {
        $username = $session->get("username");
        $sessionData = $session->get(TwofaService::SESSION_KEY);
        if ($sessionData === null) {
            throw new \io\privfs\core\JsonRpcException("TWOFA_INVALID_SESSION");
        }
        if (isset($sessionData["resent"]) && $sessionData["resent"]) {
            throw new JsonRpcException("TWOFA_CODE_ALREADY_RESEND");
        }
        if ($sessionData["type"] == "email") {
            if (!$this->sendEmailWithCode($username, $sessionData["email"], $sessionData["code"])) {
                throw new JsonRpcException("TWOFA_CANNOT_SEND_CODE");
            }
        }
        else if ($sessionData["type"] == "sms") {
            if (!$this->sendSmsWithCode($username, $sessionData["mobile"], $sessionData["code"])) {
                throw new JsonRpcException("TWOFA_CANNOT_SEND_CODE");
            }
        }
        else {
            throw new JsonRpcException("TWOFA_INVALID_TYPE", "Cannot resend " . $type);
        }
        $sessionData["resent"] = true;
        $session->set(TwofaService::SESSION_KEY, $sessionData);
        return "OK";
    }
    
    public function getSettingForLanguage($setting, $lang) {
        if ($lang && isset($setting["langs"][$lang])) {
            return $setting["langs"][$lang];
        }
        return $setting["langs"][$setting["defaultLang"]];
    }
    
    public function sendEmailWithCode($username, $email, $code) {
        $user = $this->userService->getUser($username, null, false);
        $config = $this->getSettingForLanguage(TwofaService::$templates["emailCode"], isset($user["language"]) ? $user["language"] : "");
        $body = $config["body"];
        $from = array(
            "name" => $config["from"]["name"],
            "email" => $this->config->getServerEmailNoReply()
        );
        $body = str_replace("{code}", $code, $body);
        $subject = $config["subject"];
        if (!$this->mailService->send($from, $email, $subject, $body, $config["isHtml"])) {
            $this->logger->error("Cannot send mail with 2FA code to '$username' ('$email') - unknown error");
            return false;
        }
        $this->logger->debug("Successfully sent email with 2FA code to '$username' ('$email')");
        return true;
    }
    
    public function sendSmsWithCode($username, $mobile, $code) {
        $user = $this->userService->getUser($username, null, false);
        $config = $this->getSettingForLanguage(TwofaService::$templates["smsCode"], isset($user["language"]) ? $user["language"] : "");
        $message = $config["message"];
        $message = str_replace("{code}", $code, $message);
        if (!$this->smsService->isEnabled()) {
            $this->logger->error("Cannot send sms with 2FA code to '$username' ('$mobile') - missing registered SmsService callback");
            return false;
        }
        if (!$this->smsService->send($mobile, $message)) {
            $this->logger->error("Cannot send sms with 2FA code to '$username' ('$mobile') - unknown error");
            return false;
        }
        $this->logger->debug("Successfully sent sms with 2FA code to '$username' ('$mobile')");
        return true;
    }
}

TwofaService::$templates = array(
    "emailCode" => array(
        "defaultLang" => "en",
        "langs" => array(
            "en" => array(
                "from" => array(
                    "name" => "PrivMX"
                ),
                "isHtml" => false,
                "subject" => "[PrivMX] Verification Code",
                "body" => "\nPrivMX Verification code:\n{code}\n\n(this email has been generated by my PrivMX private mail server)"
            ),
            "pl" => array(
                "from" => array(
                    "name" => "PrivMX"
                ),
                "isHtml" => false,
                "subject" => "[PrivMX] Kod weryfikacyjny",
                "body" => "\nKod weryfikacyjny PrivMX:\n{code}\n\n(ten email został wygenerowany przez mój serwer prywatnej poczty PrivMX)"
            )
        )
    ),
    "smsCode" => array(
        "defaultLang" => "en",
        "langs" => array(
            "en" => array(
                "message" => "PrivMX Verification code: {code}"
            ),
            "pl" => array(
                "message" => "Kod weryfikacyjny PrivMX: {code}"
            )
        )
    )
);