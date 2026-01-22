(function () {
  const CDN_PSL_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/psl/dist/psl.min.js";
  const API_BASE_URL = "https://www.pushlapgrowth.com";


  // =============================================
    // DEBUG LOGGER
  // =============================================

    let DEBUG_LOGGING_ENABLED = false;

    function log(...args) {
    if (DEBUG_LOGGING_ENABLED && typeof console !== "undefined") {
        console.log("[Push Lap Growth]", ...args);
    }
    }

  // =============================================
  // STORAGE ABSTRACTION (Cookie + localStorage fallback)
  // =============================================

  function loadPslScript(callback) {
    const script = document.createElement("script");
    script.src = CDN_PSL_SCRIPT_URL;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function removeSubdomain(hostname) {
    if (hostname === "localhost") return hostname;
    if (typeof psl === "undefined") return hostname;
    const parsed = psl.parse(hostname);
    return parsed.domain;
  }

  // Check if cookies are available
  function areCookiesEnabled() {
    try {
      document.cookie = "plg_test=1; SameSite=Lax";
      const cookiesEnabled = document.cookie.indexOf("plg_test=") !== -1;
      document.cookie =
        "plg_test=1; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      return cookiesEnabled;
    } catch (e) {
      return false;
    }
  }

  // Check if localStorage is available
  function isLocalStorageAvailable() {
    try {
      const testKey = "plg_ls_test";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  const useLocalStorage = !areCookiesEnabled() && isLocalStorageAvailable();
  
  log("Push Lap Growth: Using " +
      (useLocalStorage ? "localStorage" : "cookies") +
      " for storage"
    );

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    const domain = removeSubdomain(window.location.hostname);
    document.cookie = `${name}=${encodeURIComponent(
      value
    )}; expires=${expires}; path=/; domain=.${domain}; samesite=none; secure`;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2)
      return decodeURIComponent(parts.pop().split(";").shift());
  }

  function deleteCookie(name) {
    const domain = removeSubdomain(window.location.hostname);
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}; samesite=none; secure`;
  }

  // Unified storage functions with fallback
  function setStorage(name, value, days) {
    if (useLocalStorage) {
      try {
        const data = {
          value: value,
          expires: Date.now() + days * 864e5,
        };
        localStorage.setItem(name, JSON.stringify(data));
      } catch (e) {
        log("Push Lap Growth: localStorage setItem failed", e);
      }
    } else {
      setCookie(name, value, days);
    }
  }

  function getStorage(name) {
    if (useLocalStorage) {
      try {
        const item = localStorage.getItem(name);
        if (!item) return null;
        const data = JSON.parse(item);
        if (data.expires && Date.now() > data.expires) {
          localStorage.removeItem(name);
          return null;
        }
        return data.value;
      } catch (e) {
        return null;
      }
    } else {
      return getCookie(name);
    }
  }

  function deleteStorage(name) {
    if (useLocalStorage) {
      try {
        localStorage.removeItem(name);
      } catch (e) {
        log("Push Lap Growth: localStorage removeItem failed", e);
      }
    } else {
      deleteCookie(name);
    }
  }

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  function getQueryParam(param) {
    const scripts = document.getElementsByTagName("script");
    const currentScript = Array.from(scripts).find(
      (script) =>
        script.src &&
        script.src.startsWith("https://pushlapgrowth.com/affiliate-tracker.js")
    );
    if (!currentScript?.src) return null;
    const scriptUrl = new URL(currentScript.src);
    return scriptUrl.searchParams.get(param);
  }

  function setPickaxe(affiliateId) {
    window.PickaxeStudioConfig = {
      ...window.PickaxeStudioConfig,
      affiliateId: affiliateId,
    };
  }

  // =============================================
  // BROWSER DATA COLLECTION
  // =============================================

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || null,
      utmMedium: params.get("utm_medium") || null,
      utmCampaign: params.get("utm_campaign") || null,
      utmTerm: params.get("utm_term") || null,
      utmContent: params.get("utm_content") || null,
      gclid: params.get("gclid") || null,
      gbraid: params.get("gbraid") || null,
      wbraid: params.get("wbraid") || null,
      fbclid: params.get("fbclid") || null,
      msclkid: params.get("msclkid") || null,
      ttclid: params.get("ttclid") || null,
      twclid: params.get("twclid") || null,
      liFatId: params.get("li_fat_id") || null,
    };
  }

  function parseReferrerDomain(referrer) {
    if (!referrer) return null;
    try {
      const url = new URL(referrer);
      return url.hostname;
    } catch (e) {
      return null;
    }
  }

  function classifyReferrerType(referrerDomain, urlParams) {
    if (!referrerDomain) return "direct";

    // Check for paid traffic via click IDs
    if (urlParams.gclid || urlParams.gbraid || urlParams.wbraid) return "paid";
    if (urlParams.fbclid) return "paid";
    if (urlParams.msclkid) return "paid";
    if (urlParams.ttclid) return "paid";
    if (urlParams.twclid) return "paid";
    if (urlParams.liFatId) return "paid";

    const domain = referrerDomain.toLowerCase();

    // Search engines
    const searchEngines = [
      "google",
      "bing",
      "yahoo",
      "duckduckgo",
      "baidu",
      "yandex",
      "ecosia",
      "ask",
      "aol",
      "startpage",
      "qwant",
      "brave",
    ];
    if (searchEngines.some((se) => domain.includes(se))) return "search";

    // Social media platforms
    const socialPlatforms = [
      "facebook",
      "fb.com",
      "instagram",
      "twitter",
      "x.com",
      "linkedin",
      "pinterest",
      "tiktok",
      "reddit",
      "youtube",
      "snapchat",
      "whatsapp",
      "telegram",
      "discord",
      "tumblr",
      "threads.net",
      "mastodon",
    ];
    if (socialPlatforms.some((sp) => domain.includes(sp))) return "social";

    // Email providers (common ones)
    const emailProviders = [
      "mail",
      "outlook",
      "yahoo",
      "gmail",
      "protonmail",
      "zoho",
      "mailchimp",
      "sendgrid",
      "constantcontact",
      "hubspot",
      "klaviyo",
      "convertkit",
      "drip",
    ];
    if (emailProviders.some((ep) => domain.includes(ep))) return "email";

    return "unknown";
  }

  function parseBrowserInfo(userAgent) {
    if (!userAgent) return { browserName: null, browserVersion: null };

    let browserName = null;
    let browserVersion = null;

    // Order matters - check more specific patterns first
    if (userAgent.includes("Edg/")) {
      browserName = "Edge";
      browserVersion = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("OPR/") || userAgent.includes("Opera")) {
      browserName = "Opera";
      browserVersion = userAgent.match(/(?:OPR|Opera)\/([0-9.]+)/)?.[1] || null;
    } else if (
      userAgent.includes("Chrome/") &&
      !userAgent.includes("Chromium")
    ) {
      browserName = "Chrome";
      browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
      browserName = "Safari";
      browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("Firefox/")) {
      browserName = "Firefox";
      browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || null;
    } else if (userAgent.includes("MSIE") || userAgent.includes("Trident/")) {
      browserName = "Internet Explorer";
      browserVersion = userAgent.match(/(?:MSIE |rv:)([0-9.]+)/)?.[1] || null;
    }

    return { browserName, browserVersion };
  }

  function parseOsInfo(userAgent) {
    if (!userAgent) return { osName: null, osVersion: null };

    let osName = null;
    let osVersion = null;

    if (userAgent.includes("Windows")) {
      osName = "Windows";
      if (userAgent.includes("Windows NT 10.0")) osVersion = "10";
      else if (userAgent.includes("Windows NT 6.3")) osVersion = "8.1";
      else if (userAgent.includes("Windows NT 6.2")) osVersion = "8";
      else if (userAgent.includes("Windows NT 6.1")) osVersion = "7";
    } else if (userAgent.includes("Mac OS X")) {
      osName = "macOS";
      const match = userAgent.match(/Mac OS X ([0-9_]+)/);
      if (match) osVersion = match[1].replace(/_/g, ".");
    } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
      osName = "iOS";
      const match = userAgent.match(/OS ([0-9_]+)/);
      if (match) osVersion = match[1].replace(/_/g, ".");
    } else if (userAgent.includes("Android")) {
      osName = "Android";
      const match = userAgent.match(/Android ([0-9.]+)/);
      if (match) osVersion = match[1];
    } else if (userAgent.includes("Linux")) {
      osName = "Linux";
    } else if (userAgent.includes("CrOS")) {
      osName = "Chrome OS";
    }

    return { osName, osVersion };
  }

  function detectDeviceType(userAgent) {
    if (!userAgent) return "desktop";
    const ua = userAgent.toLowerCase();

    // Check for tablets first
    if (
      ua.includes("ipad") ||
      (ua.includes("android") && !ua.includes("mobile")) ||
      ua.includes("tablet")
    ) {
      return "tablet";
    }

    // Check for mobile devices
    if (
      ua.includes("mobile") ||
      ua.includes("iphone") ||
      ua.includes("ipod") ||
      ua.includes("android") ||
      ua.includes("blackberry") ||
      ua.includes("windows phone")
    ) {
      return "mobile";
    }

    return "desktop";
  }

  function collectBrowserData() {
    const userAgent = navigator.userAgent || null;
    const urlParams = getUrlParams();
    const referrerDomain = parseReferrerDomain(document.referrer);
    const { browserName, browserVersion } = parseBrowserInfo(userAgent);
    const { osName, osVersion } = parseOsInfo(userAgent);
    const deviceType = detectDeviceType(userAgent);

    return {
      // URL and Landing Page Data
      fullLandingUrl: window.location.href,
      pathname: window.location.pathname,
      queryString: window.location.search || null,

      // UTM Parameters
      ...urlParams,

      // Referrer Data
      documentReferrer: document.referrer || null,
      referrerDomain: referrerDomain,
      referrerType: classifyReferrerType(referrerDomain, urlParams),

      // User Agent and Device Info
      userAgent: userAgent,
      browserName: browserName,
      browserVersion: browserVersion,
      osName: osName,
      osVersion: osVersion,
      deviceType: deviceType,

      // Screen and Viewport Data
      screenWidth: window.screen?.width || null,
      screenHeight: window.screen?.height || null,
      colorDepth: window.screen?.colorDepth || null,
      pixelRatio: window.devicePixelRatio || null,
      viewportWidth: window.innerWidth || null,
      viewportHeight: window.innerHeight || null,

      // Language Settings
      language: navigator.language || null,
      languages: navigator.languages
        ? JSON.stringify(navigator.languages)
        : null,
    };
  }

  // =============================================
  // MAIN TRACKING LOGIC
  // =============================================

  loadPslScript(async function () {
    const urlParams = new URLSearchParams(window.location.search);

    const affiliateProgramId =
      document
        .querySelector("script[data-affiliate]")
        ?.getAttribute("data-program-id") ?? getQueryParam("programId");
    log("Affiliate Program ID: ", affiliateProgramId);

    if (!affiliateProgramId) return;

    try {
      // First fetch the affiliate program to get the urlModifier
      const affiliateProgramResponse = await fetch(
        `${API_BASE_URL}/api/affiliates/affiliate-program?programId=${affiliateProgramId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      const affiliateProgramData = await affiliateProgramResponse.json();

      if (!affiliateProgramData || !affiliateProgramData.program) return;

      // Check if debug is enabled      

      DEBUG_LOGGING_ENABLED = Boolean(affiliateProgramData.program.enableDebugLogs);

      // Get the urlModifier from the program data, default to "ref" if not set
      const urlModifier = affiliateProgramData.program.urlModifier || "ref";
      log("Using URL modifier:", urlModifier);

      // Now get the affiliate ref based on the urlModifier
      const affiliateParam = urlParams.get(urlModifier);
      log(`URL search params:`, window.location.search);
      log(
        `Affiliate param from URL (${urlModifier}=):`,
        affiliateParam
      );

      const refCookieName = `${affiliateProgramId}_affiliate_ref`;
      const clickIdCookieName = `${affiliateProgramId}_affiliate_referral`;

      let existingRef = getStorage(refCookieName) || null;
      let existingClickId = getStorage(clickIdCookieName) || null;

      log("Existing Affiliate Ref: ", existingRef);
      log("Existing Click ID: ", existingClickId);

      // Initialize window variables
      window.affiliateRef = null;
      window.affiliateId = null;

      // Determine which affiliate ref to use
      const currentAffiliateParam = affiliateParam || existingRef;

      // Set the affiliate ref (the actual referral code)
      if (currentAffiliateParam) {
        window.affiliateRef = currentAffiliateParam;
        // Set affiliateId to the ref initially (immediately available)
        window.affiliateId = currentAffiliateParam;

        // If we have an existing click ID for this ref, update to use it
        if (existingRef === currentAffiliateParam && existingClickId) {
          window.affiliateId = existingClickId;
          if (existingClickId) {
            setPickaxe(existingClickId);
          }
          log("Using existing affiliate data:", {
            ref: existingRef,
            clickId: existingClickId,
          });
        } else {
          log(
            "Affiliate ref set, click ID will be updated when available:",
            {
              ref: currentAffiliateParam,
            }
          );
        }
      }

      // Function to handle new clicks
      async function handleReferral() {
        const programIdElement = document.querySelector(
          "script[data-affiliate]"
        );
        const programId = programIdElement
          ? programIdElement.getAttribute("data-program-id")
          : getQueryParam("programId");

        log("Program ID for referral:", programId);

        const referralCode = window.affiliateRef;
        if (!programId || !referralCode) return;

        try {
          // Collect all browser data
          const browserData = collectBrowserData();

          const response = await fetch(
            `${API_BASE_URL}/api/affiliates/add-click`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                programId,
                referralCode,
                ...browserData,
              }),
            }
          );
          const data = await response.json();

          if (data.click) {
            // Update window.affiliateId from ref to the actual click ID
            const clickId = String(data.click.id);
            const previousId = window.affiliateId;
            window.affiliateId = clickId;

            // Save click ID to storage
            setStorage(
              clickIdCookieName,
              clickId,
              affiliateProgramData.program.cookieDuration ?? 60
            );

            // Set Pickaxe with the clickId (affiliateId)
            setPickaxe(clickId);

            log("Click created with ID:", clickId);
            log("Updated window.affiliateId from ref to click ID:", {
              previous: previousId,
              current: clickId,
            });

            dispatchEvent(
              new CustomEvent("affiliate_id_ready", {
                detail: { ref: referralCode, clickId: clickId },
              })
            );
          }

          dispatchEvent(new Event("affiliate_referral_ready"));
        } catch (error) {
          deleteStorage(refCookieName);
          deleteStorage(clickIdCookieName);
          window.affiliateRef = null;
          window.affiliateId = null;
          log("Error handling click:", error);
        }
      }

      // Determine what action to take
      const isNewAffiliate = affiliateParam && existingRef !== affiliateParam;
      const hasExistingAffiliate = existingRef && !affiliateParam;
      const hasSameAffiliate = affiliateParam && existingRef === affiliateParam;

      if (isNewAffiliate || (affiliateParam && !existingClickId)) {
        // New affiliate ref OR affiliate param but no click ID yet - create a new click
        log("Creating new click for affiliate:", affiliateParam);
        await handleReferral();

        // Save the affiliate ref to storage after creating the click
        if (affiliateParam) {
          setStorage(
            refCookieName,
            affiliateParam,
            affiliateProgramData.program.cookieDuration ?? 60
          );
        }
      } else if (hasExistingAffiliate || hasSameAffiliate) {
        // Existing affiliate - dispatch ready events immediately
        log("Using existing affiliate data");

        // Dispatch both events for existing affiliates
        dispatchEvent(
          new CustomEvent("affiliate_id_ready", {
            detail: { ref: window.affiliateRef, clickId: window.affiliateId },
          })
        );

        setTimeout(
          () => dispatchEvent(new Event("affiliate_referral_ready")),
          100
        );
      } else {
        // No affiliate present - still dispatch event for integrations that need to know
        log("No affiliate tracking active");
        setTimeout(
          () => dispatchEvent(new Event("affiliate_referral_ready")),
          100
        );
      }
    } catch (e) {
      log("Error processing affiliate program: ", e);
    }
  });

  // =============================================
  // PUBLIC API FUNCTIONS
  // =============================================

  async function createPushLapEmail(email, name = "") {
    if (!email) {
      throw new Error("Email is required");
    }

    if (!window.affiliateRef) {
      return null;
    }

    try {
      const programIdElement = document.querySelector("script[data-affiliate]");
      const programId = programIdElement
        ? programIdElement.getAttribute("data-program-id")
        : getQueryParam("programId");

      log("Program ID for email capture:", programId);

      const response = await fetch(
        `${API_BASE_URL}/api/affiliates/capture-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            name: name == "" ? email : name,
            affiliateId: window.affiliateRef,
            clickId: window.affiliateId,
            programId: programId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create email capture");
      }

      return await response.json();
    } catch (error) {
      log("Error creating Push Lap email:", error);
      return null;
    }
  }

  // Make function available globally
  window.createPushLapEmail = createPushLapEmail;

  function createPushLapSale({ userId = "", amount, name = "", email }) {
    // Return early if no affiliate ref
    if (!window.affiliateRef) {
      return null;
    }

    // Validate required parameters
    if (!email || amount === undefined || amount === null) {
      log("email and amount are required parameters");
      return null;
    }

    const programIdElement = document.querySelector("script[data-affiliate]");
    const programId = programIdElement
      ? programIdElement.getAttribute("data-program-id")
      : getQueryParam("programId");

    log("Program ID for sale:", programId);

    // Make API call to record sale
    return fetch(`${API_BASE_URL}/api/affiliates/capture-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        amount,
        name,
        email,
        affiliateId: window.affiliateRef,
        clickId: window.affiliateId,
        programId: programId,
        url: window.location.href,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to record sale");
        }
        return response.json();
      })
      .catch((error) => {
        log("Error recording sale:", error);
        return null;
      });
  }

  // Make function available globally
  window.createPushLapSale = createPushLapSale;

  // =============================================
  // HELPER TO GET AFFILIATE INFO
  // =============================================

  function getPushLapAffiliateInfo() {
    return {
      ref: window.affiliateRef || null,
      clickId: window.affiliateId || null,
      storageType: useLocalStorage ? "localStorage" : "cookies",
    };
  }

  // Make function available globally
  window.getPushLapAffiliateInfo = getPushLapAffiliateInfo;
})();