/*
 * The help page's words, in English and Hindi, in one structure so the two
 * cannot drift apart in shape: a screen added to one is visibly missing from
 * the other.
 *
 * Written plainly on purpose. Every other screen speaks in the register of a
 * bureau instrument, which is right for a finding an officer signs. Someone
 * opening the tool for the first time needs the opposite: short sentences and
 * ordinary words. If a line here needs reading twice, rewrite it.
 *
 * The screen names (`nav`) and the two section names mirror the navigation —
 * same names, same order — and stay in English in the Hindi text too, because
 * the menu itself is in English: a help page that calls a screen by a name the
 * menu does not use sends the reader looking for something that is not there.
 *
 * The Hindi is a machine-drafted translation. The page says so, and it must be
 * reviewed by a native speaker before it is relied on.
 */

export type Lang = "en" | "hi";

interface Screen {
  href: string;
  nav: string;
  what: string;
  use: string;
}

export interface HelpContent {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  /** Shown above the Hindi text only. */
  reviewNote?: string;
  headings: Array<{ title: string; kicker: string }>;
  sections: Array<{ name: string; screens: Screen[] }>;
  steps: Array<{ n: string; title: string; body: string }>;
  status: Array<{ level: "HOT" | "WARM" | "COLD"; plain: string; then: string }>;
  buttons: Array<{ title: string; body: string }>;
  limits: Array<{ title: string; body: string }>;
}

const en: HelpContent = {
  eyebrow: "Help",
  title: "How to use this",
  description:
    "FineX follows stolen USDT on TRON and Ethereum and tells you whether the money can still be reached.",
  action: "Trace a wallet",
  headings: [
    { title: "The screens", kicker: "What each one is for" },
    { title: "Tracing one wallet", kicker: "Four steps" },
    { title: "What the answer means", kicker: "Every case is one of three" },
    { title: "The buttons", kicker: "What each one gives you" },
    { title: "What it cannot do", kicker: "Say this before anyone asks" },
  ],
  sections: [
    {
      name: "Casework",
      screens: [
        {
          href: "/dashboard",
          nav: "Queue",
          what: "Today's complaints, most urgent first — and alerts if money moves.",
          use: "Start here. Any wallet still holding funds is watched, and you'll see an alert at the top if the money starts to move. Turn on alerts under the watch to be told even when FineX is closed.",
        },
        {
          href: "/queue",
          nav: "Batch triage",
          what: "Paste many wallet addresses at once, or load a complaint sheet.",
          use: "Use it for a whole morning of complaints. A sheet (CSV with acknowledgement number, wallet or transaction, amount, date, state) traces each complaint with its own figures and puts its number on the freeze request. The list sorts itself as answers arrive.",
        },
        {
          href: "/investigate",
          nav: "New case",
          what: "Open one complaint: a wallet address or a transaction.",
          use: "Use it when you have one complaint. When the trace is done, View evidence packet at the bottom opens the report for that wallet.",
        },
        {
          href: "/fund-flow",
          nav: "Intelligence",
          what: "The money drawn as a picture.",
          use: "Three views of the same trace: the path, the weight, and the timing.",
        },
        {
          href: "/reports",
          nav: "Evidence",
          what: "Every case as a printable packet.",
          use: "Open one and print it for the file.",
        },
      ],
    },
    {
      name: "Method",
      screens: [
        {
          href: "/attribution",
          nav: "Attribution",
          what: "Every exchange account we can name, and how we worked it out.",
          use: "Open this when someone asks where your data comes from.",
        },
        {
          href: "/operations",
          nav: "Operating notes",
          what: "How this runs, what it costs, and what it cannot do.",
          use: "Open this before answering questions about the tool itself.",
        },
      ],
    },
  ],
  steps: [
    {
      n: "1",
      title: "Paste the address or transaction",
      body: "A TRON address starts with T and is 34 characters long. An Ethereum address starts with 0x and is 42 characters long. A transaction is 64 characters, with 0x in front on Ethereum. Each is checked before anything else happens, and a transaction shows you the wallet it paid before tracing it. An address from any other chain, such as Bitcoin, is not traced: it is checked against the sanctions list instead.",
    },
    {
      n: "2",
      title: "Leave amount and date empty",
      body: "Both are optional. Left blank, we follow everything that ever left the wallet. Fill them in only if the complaint gives an exact figure or date.",
    },
    {
      n: "3",
      title: "Wait about half a minute",
      body: "You will see each wallet as it is read. That is the real progress of the search, not a loading bar.",
    },
    {
      n: "4",
      title: "Read the top line",
      body: "One sentence tells you whether the money can still be reached. Everything below it is the working.",
    },
  ],
  status: [
    {
      level: "HOT",
      plain: "The money is still sitting somewhere.",
      then: "Nothing has left the wallet it landed in. This is where your next hour goes.",
    },
    {
      level: "WARM",
      plain: "The money reached an exchange.",
      then: "We name the account inside that exchange. Open Freeze request and send it to them.",
    },
    {
      level: "COLD",
      plain: "The trail ends here.",
      then: "It went into a mixing service or a sanctioned address. Nobody can follow it further. Write it up and close it.",
    },
  ],
  buttons: [
    {
      title: "Evidence packet",
      body: "The whole case on one printable page. It ends with a fingerprint and a code. Anyone holding a copy can scan the code to check its figures against the chain.",
    },
    {
      title: "Freeze request",
      body: "The letter you send the exchange, naming the account to restrict. It only appears when there is an exchange that can act on it. Above it: where that exchange takes requests, and what it needs first. Sign it before it goes out.",
    },
    {
      title: "Record what happened",
      body: "Under every freeze request. After you send it, write down what the exchange did. The case queue counts these, exchange by exchange. They stay in your browser; export them to share.",
    },
    {
      title: "Permalink",
      body: "A link that reopens this exact result with the same figures. Safe to forward.",
    },
    {
      title: "Save case",
      body: "Keeps this result in the case file on the queue, where every officer using this server sees it. What is kept is the server's own record of the trace, so opening it shows the same figures again. Who saved it goes into the audit log.",
    },
    {
      title: "The small icon next to any address",
      body: "Opens that wallet on its own: how old it is, who paid into it, and where it sent money. Press Trace the payers back to see which exchanges gave the payers their money.",
    },
  ],
  limits: [
    {
      title: "It cannot name a person",
      body: "We name the account at the exchange. Only the exchange knows who owns it. That is why the freeze request goes to them.",
    },
    {
      title: "It cannot follow money past a mixer",
      body: "Nobody can. We mark where the trail ends and stop, rather than guess.",
    },
    {
      title: "It covers USDT on TRON and Ethereum only",
      body: "That is where this kind of fraud money mostly moves. On Ethereum it reads the main network only: the same 0x address on BNB Chain or Polygon is not read. When money goes into a swap or a bridge, the trace stops there and says so.",
    },
    {
      title: "It never reports silence as an answer",
      body: "If the chain could not be read, the screen says so. It will not tell you a wallet is empty when we simply could not see it.",
    },
  ],
};

const hi: HelpContent = {
  eyebrow: "सहायता",
  title: "इसका उपयोग कैसे करें",
  description:
    "FineX, TRON और Ethereum पर चोरी हुए USDT का पीछा करता है और बताता है कि पैसा अभी भी पकड़ में आ सकता है या नहीं।",
  action: "वॉलेट ट्रेस करें",
  reviewNote:
    "यह पृष्ठ मशीन की सहायता से हिन्दी में अनुवादित है। इस पर भरोसा करने से पहले किसी हिन्दी भाषी अधिकारी से इसकी समीक्षा कराएँ। मेन्यू और बाकी सभी स्क्रीन अंग्रेज़ी में हैं, इसलिए स्क्रीनों और बटनों के नाम यहाँ भी अंग्रेज़ी में दिए गए हैं।",
  headings: [
    { title: "स्क्रीनें", kicker: "हर स्क्रीन किस काम की है" },
    { title: "एक वॉलेट ट्रेस करना", kicker: "चार चरण" },
    { title: "उत्तर का अर्थ", kicker: "हर मामला इन तीन में से एक होता है" },
    { title: "बटन", kicker: "हर बटन से आपको क्या मिलता है" },
    { title: "यह क्या नहीं कर सकता", kicker: "कोई पूछे, उससे पहले ही बता दें" },
  ],
  sections: [
    {
      name: "Casework",
      screens: [
        {
          href: "/dashboard",
          nav: "Queue",
          what: "आज की शिकायतें, सबसे ज़रूरी सबसे ऊपर — और पैसा हिलने पर अलर्ट।",
          use: "यहीं से शुरू करें। जिस वॉलेट में पैसा अभी भी पड़ा है, उस पर नज़र रखी जाती है, और पैसा हिलते ही सबसे ऊपर अलर्ट दिखता है। FineX बंद होने पर भी सूचना पाने के लिए, नज़र वाली सूची के नीचे Turn on alerts दबाएँ।",
        },
        {
          href: "/queue",
          nav: "Batch triage",
          what: "एक साथ कई वॉलेट पते डालें, या शिकायतों की शीट लोड करें।",
          use: "पूरी सुबह की शिकायतों के लिए। शीट (CSV जिसमें पावती संख्या, वॉलेट या ट्रांज़ैक्शन, राशि, तारीख और राज्य हों) हर शिकायत को उसके अपने आँकड़ों से ट्रेस करती है और उसकी संख्या फ्रीज़ अनुरोध पर छापती है। जैसे-जैसे उत्तर आते हैं, सूची अपने-आप क्रम में लगती जाती है।",
        },
        {
          href: "/investigate",
          nav: "New case",
          what: "एक शिकायत खोलें: वॉलेट का पता या कोई ट्रांज़ैक्शन।",
          use: "जब आपके पास एक ही शिकायत हो। ट्रेस पूरा होने पर नीचे View evidence packet उस वॉलेट की रिपोर्ट खोलता है।",
        },
        {
          href: "/fund-flow",
          nav: "Intelligence",
          what: "पैसे का रास्ता, चित्र के रूप में।",
          use: "एक ही ट्रेस के तीन दृश्य: रास्ता, वज़न और समय।",
        },
        {
          href: "/reports",
          nav: "Evidence",
          what: "हर मामला, छापने योग्य पैकेट के रूप में।",
          use: "कोई एक खोलें और फ़ाइल के लिए छाप लें।",
        },
      ],
    },
    {
      name: "Method",
      screens: [
        {
          href: "/attribution",
          nav: "Attribution",
          what: "हर एक्सचेंज खाता जिसका हम नाम बता सकते हैं, और हमने यह कैसे पता लगाया।",
          use: "जब कोई पूछे कि आपका डेटा कहाँ से आता है, तब इसे खोलें।",
        },
        {
          href: "/operations",
          nav: "Operating notes",
          what: "यह कैसे चलता है, इसका खर्च क्या है, और यह क्या नहीं कर सकता।",
          use: "इस उपकरण के बारे में सवालों का जवाब देने से पहले इसे खोलें।",
        },
      ],
    },
  ],
  steps: [
    {
      n: "1",
      title: "पता या ट्रांज़ैक्शन चिपकाएँ",
      body: "TRON का पता T से शुरू होता है और 34 अक्षरों का होता है। Ethereum का पता 0x से शुरू होता है और 42 अक्षरों का होता है। ट्रांज़ैक्शन 64 अक्षरों का होता है, Ethereum पर आगे 0x लगा होता है। कुछ भी करने से पहले हर एक की जाँच होती है, और ट्रांज़ैक्शन ट्रेस से पहले वह वॉलेट दिखाता है जिसे भुगतान गया था। किसी दूसरी चेन का पता, जैसे Bitcoin, ट्रेस नहीं होता: उसकी जाँच प्रतिबंध सूची (sanctions list) से की जाती है।",
    },
    {
      n: "2",
      title: "राशि और तारीख खाली छोड़ें",
      body: "दोनों वैकल्पिक हैं। खाली छोड़ने पर वॉलेट से कभी भी निकला सारा पैसा ट्रेस होता है। इन्हें तभी भरें जब शिकायत में सटीक राशि या तारीख दी गई हो।",
    },
    {
      n: "3",
      title: "लगभग आधा मिनट रुकें",
      body: "हर वॉलेट पढ़े जाते समय दिखता है। यह खोज की असली प्रगति है, कोई लोडिंग बार नहीं।",
    },
    {
      n: "4",
      title: "सबसे ऊपर की पंक्ति पढ़ें",
      body: "एक वाक्य बताता है कि पैसा अभी भी पकड़ में आ सकता है या नहीं। उसके नीचे सब कुछ उसका आधार है।",
    },
  ],
  status: [
    {
      level: "HOT",
      plain: "पैसा अभी भी कहीं पड़ा है।",
      then: "जिस वॉलेट में पैसा पहुँचा, वहाँ से कुछ नहीं निकला। आपका अगला घंटा इसी पर लगना चाहिए।",
    },
    {
      level: "WARM",
      plain: "पैसा किसी एक्सचेंज तक पहुँच गया।",
      then: "हम उस एक्सचेंज के अंदर का खाता बताते हैं। Freeze request खोलें और उन्हें भेजें।",
    },
    {
      level: "COLD",
      plain: "रास्ता यहीं खत्म होता है।",
      then: "पैसा किसी मिक्सिंग सेवा या प्रतिबंधित पते में गया। इसके आगे कोई उसका पीछा नहीं कर सकता। इसे दर्ज करें और मामला बंद करें।",
    },
  ],
  buttons: [
    {
      title: "Evidence packet",
      body: "पूरा मामला, एक छापने योग्य पृष्ठ पर। इसके अंत में एक फ़िंगरप्रिंट और एक कोड है। प्रति रखने वाला कोई भी व्यक्ति कोड स्कैन करके उसके आँकड़े चेन से मिला सकता है।",
    },
    {
      title: "Freeze request",
      body: "एक्सचेंज को भेजा जाने वाला पत्र, जिसमें रोका जाने वाला खाता लिखा होता है। यह तभी दिखता है जब कोई एक्सचेंज उस पर कार्रवाई कर सकता हो। इसके ऊपर लिखा है कि वह एक्सचेंज अनुरोध कहाँ लेता है और पहले क्या चाहता है। भेजने से पहले इस पर हस्ताक्षर करें।",
    },
    {
      title: "Record what happened",
      body: "हर फ्रीज़ अनुरोध के नीचे। भेजने के बाद लिखें कि एक्सचेंज ने क्या किया। Queue स्क्रीन इन्हें एक्सचेंज के हिसाब से गिनती है। ये आपके ब्राउज़र में ही रहते हैं; साझा करने के लिए इन्हें export करें।",
    },
    {
      title: "Permalink",
      body: "एक लिंक जो यही नतीजा उन्हीं आँकड़ों के साथ फिर से खोलता है। आगे भेजना सुरक्षित है।",
    },
    {
      title: "Save case",
      body: "यह नतीजा Queue की case file में रखता है, जहाँ इस सर्वर का हर अधिकारी उसे देखता है। रखा जाता है सर्वर का अपना ट्रेस रिकॉर्ड, इसलिए खोलने पर वही आँकड़े फिर दिखते हैं। किसने सहेजा, यह ऑडिट लॉग में दर्ज होता है।",
    },
    {
      title: "किसी भी पते के पास का छोटा आइकन",
      body: "उस वॉलेट को अलग से खोलता है: वह कितना पुराना है, किसने उसमें पैसा डाला, और उसने पैसा कहाँ भेजा। Trace the payers back दबाएँ तो दिखेगा कि भुगतान करने वालों को उनका पैसा किन एक्सचेंजों से मिला।",
    },
  ],
  limits: [
    {
      title: "यह किसी व्यक्ति का नाम नहीं बता सकता",
      body: "हम एक्सचेंज पर खाते का नाम बताते हैं। खाता किसका है, यह केवल एक्सचेंज जानता है। इसीलिए फ्रीज़ अनुरोध उन्हीं को जाता है।",
    },
    {
      title: "यह मिक्सर के आगे पैसे का पीछा नहीं कर सकता",
      body: "कोई नहीं कर सकता। हम बताते हैं कि रास्ता कहाँ खत्म हुआ और वहीं रुक जाते हैं, अनुमान नहीं लगाते।",
    },
    {
      title: "यह केवल TRON और Ethereum पर USDT देखता है",
      body: "इस तरह की ठगी का पैसा ज़्यादातर यहीं चलता है। Ethereum पर यह केवल मुख्य नेटवर्क पढ़ता है: BNB Chain या Polygon पर वही 0x पता नहीं पढ़ा जाता। जब पैसा किसी स्वैप या ब्रिज में जाता है, तो ट्रेस वहीं रुकता है और यह बताता है।",
    },
    {
      title: "यह चुप्पी को उत्तर नहीं बताता",
      body: "अगर चेन पढ़ी नहीं जा सकी, तो स्क्रीन यही कहती है। जब हम कुछ देख ही नहीं पाए, तब यह नहीं कहेगा कि वॉलेट खाली है।",
    },
  ],
};

export const HELP: Record<Lang, HelpContent> = { en, hi };
