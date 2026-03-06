import crypto from "crypto";
import User from "../modals/User.js";

export const invitePartner = async (req, res) => {
  try {
    const userId = req.user.id;
    const { partnerEmail } = req.body;

    if (!partnerEmail) {
      return res.status(400).json({
        success: false,
        message: "Partner email is required",
      });
    }

    // Add before querying DB
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(partnerEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.partnerId) {
      return res.status(400).json({
        success: false,
        message: "You are already connected with a partner",
      });
    }

    //  Check partner exists
    const partner = await User.findOne({ email: partnerEmail });

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Partner email not registered",
      });
    }

    //  Prevent self invite
    if (partner._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot invite yourself",
      });
    }

    //  Check partner not already connected
    if (partner.partnerId) {
      return res.status(400).json({
        success: false,
        message: "This user is already connected with someone",
      });
    }

    if (!partner.onboardingSeen) {
      return res.status(400).json({
        success: false,
        message: "Unable to connect — this user has not completed onboarding yet.",
      });
    }

    //  Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    user.partnerInviteToken = token;
    user.partnerInviteExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    user.invitedPartnerEmail = partnerEmail; // optional tracking

    await user.save();

    const inviteLink = `${process.env.BASE_URL}/api/invitepartner/connect/${token}`;

    try {
      await fetch("https://email-service-chi-lemon.vercel.app/send-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: partnerEmail,
          subject: "💌 Someone special wants to connect with you on Evol",
          message: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: auto; padding: 32px; background: #fff0f5; border-radius: 16px;">
        
        <h1 style="color: #e75480; text-align: center; font-size: 28px;">💕 You've Been Invited</h1>
        
        <p style="color: #555; font-size: 16px; line-height: 1.8; text-align: center;">
          Someone who cares deeply about you wants to share something beautiful —
          <br/>a space made just for the two of you.
        </p>

        <p style="color: #777; font-size: 15px; line-height: 1.8; text-align: center;">
          <em>Evol</em> is where love lives — your memories, your moments, your journey together.
          You've been personally invited to begin that journey.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteLink}"
            style="background: linear-gradient(135deg, #ff6b9d, #e75480);
                   color: white;
                   padding: 14px 36px;
                   border-radius: 50px;
                   text-decoration: none;
                   font-size: 16px;
                   font-weight: bold;
                   letter-spacing: 1px;">
            💝 Accept Invitation
          </a>
        </div>

        <p style="color: #aaa; font-size: 13px; text-align: center; margin-top: 24px;">
          This invitation was sent with love and expires in 24 hours. <br/>
          If you didn't expect this, you can safely ignore this email.
        </p>

        <p style="color: #e75480; font-size: 18px; text-align: center; margin-top: 16px;">
          — With love, the Evol team 💗
        </p>

      </div>
    `,
        }),
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      return res.status(500).json({
        success: false,
        message: "Invite created but failed to send email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invite link generated successfully",
      inviteLink, // remove in production if sending via email
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};





export const acceptPartnerInvite = async (req, res) => {
  try {
    const { token, loverBirthDate } = req.body;
    const receiverId = req.user.id;

    if (!token || !loverBirthDate) {
      return res.status(400).json({
        success: false,
        message: "Token and lover's birth date are required.",
      });
    }

    //  Find sender by token
    const sender = await User.findOne({
      partnerInviteToken: token,
      partnerInviteExpires: { $gt: Date.now() },
    });

    if (!sender) {
      return res.status(400).json({
        success: false,
        message: "Invite link is expired or invalid.",
      });
    }

    //  Sender already connected
    if (sender.partnerId) {
      return res.status(400).json({
        success: false,
        message: "This user is already connected with someone.",
      });
    }

    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    //  Receiver already connected
    if (receiver.partnerId) {
      return res.status(400).json({
        success: false,
        message: "You are already connected with someone.",
      });
    }

    //  Security — verify invite email matches receiver
    if (!sender.invitedPartnerEmail) {
      return res.status(400).json({
        success: false,
        message: "Invalid invite configuration.",
      });
    }

    if (receiver.email.toLowerCase() !== sender.invitedPartnerEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: "This invite was not sent to your account.",
      });
    }

    //  Onboarding check
    if (!sender.onboardingSeen || !receiver.onboardingSeen) {
      return res.status(400).json({
        success: false,
        message: "Both users must complete onboarding before connecting.",
      });
    }

    //  Verify lover's birth date BEFORE connecting
    const senderDOB = sender.dateOfBirth.toISOString().split("T")[0];

    if (senderDOB !== loverBirthDate) {
      return res.status(403).json({
        success: false,
        message: "The birth date you entered does not match your partner's date of birth.",
      });
    }

    //  Connect both users
    sender.partnerId = receiver._id;
    receiver.partnerId = sender._id;

    //  Clear invite token after use
    sender.partnerInviteToken = null;
    sender.partnerInviteExpires = null;
    sender.invitedPartnerEmail = null;

    await sender.save();
    await receiver.save();

    return res.status(200).json({
      success: true,
      message: "You are now connected ❤️",
    });
  } catch (error) {
    console.error("Accept Invite Error:", error);
    return res.status(500).json({
      success: false,
      message: "An unexpected server error occurred. Please try again.",
    });
  }
};




export const handleInviteRedirect = async (req, res) => {
  try {
    const { token } = req.params;

    const sender = await User.findOne({
      partnerInviteToken: token,
      partnerInviteExpires: { $gt: Date.now() },
    });

    if (!sender) {
      return res.status(400).send(`
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Invalid Link</title>
        <style>
          body{font-family:system-ui;background:#FFF7FA;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
          .card{background:#fff;border-radius:24px;padding:40px 28px;text-align:center;box-shadow:0 8px 32px rgba(232,83,122,.12);max-width:380px;width:100%}
        </style>
        </head><body>
        <div class="card">
          <div style="font-size:52px;margin-bottom:18px">💔</div>
          <h2 style="color:#1E1128;margin:0 0 10px;font-size:21px">Link Expired</h2>
          <p style="color:#7C5E6B;font-size:14px;line-height:1.6;margin:0">
            This invite link has expired or already been used.<br/>
            Ask your partner to send a new invite from the app.
          </p>
        </div>
        </body></html>
      `);
    }

    const deepLink = `evol://accept-invite?token=${token}`;

    // In handleInviteRedirect — change intentUrl format:
    const intentUrl = `intent://accept-invite?token=${token}#Intent;scheme=evol;package=com.evol;end`;


    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Connect on Evol 💕</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            background:linear-gradient(145deg,#FFF0F5,#FFF7FA,#FFF0F5);
            min-height:100vh;display:flex;align-items:center;
            justify-content:center;padding:24px;
          }
          .card{
            background:#fff;border-radius:28px;padding:44px 28px 36px;
            text-align:center;box-shadow:0 12px 48px rgba(232,83,122,.15);
            max-width:400px;width:100%;border:1.5px solid #FBCFE8;
            animation:up .5s ease;
          }
          @keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
          .icon{
            width:86px;height:86px;background:#FFF0F5;border-radius:26px;
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 22px;font-size:42px;border:1.5px solid #FBCFE8;
            animation:pulse 1.6s ease-in-out infinite;
          }
          @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
          h1{font-size:23px;font-weight:900;color:#1E1128;margin-bottom:10px}
          .sub{font-size:14px;color:#7C5E6B;line-height:1.65;margin-bottom:28px}
          .btn{
            display:block;width:100%;padding:17px;border-radius:16px;
            font-size:16px;font-weight:800;text-decoration:none;
            border:none;cursor:pointer;
          }
          .btn-primary{
            background:#E8537A;color:#fff;
            box-shadow:0 6px 24px rgba(232,83,122,.35);
            margin-bottom:12px;
          }
          .btn-secondary{
            background:#FFF0F5;color:#E8537A;
            border:1.5px solid #FBCFE8;font-size:14px;
          }
          #status{font-size:12px;color:#C4A8B4;margin:8px 0 14px;min-height:18px}
          .steps{
            margin-top:28px;background:#FFF7FA;border-radius:16px;
            padding:18px;border:1px solid #F5DCE8;text-align:left;
          }
          .steps-label{font-size:10px;font-weight:700;color:#C4A8B4;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px}
          .step{display:flex;align-items:center;gap:12px;margin-bottom:9px}
          .step:last-child{margin-bottom:0}
          .num{
            width:24px;height:24px;border-radius:50%;background:#FBCFE8;
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:800;color:#E8537A;flex-shrink:0;
          }
          .step-text{font-size:13px;color:#7C5E6B}
          .footer{margin-top:22px;font-size:11px;color:#C4A8B4}
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">💕</div>
          <h1>You're Invited!</h1>
          <p class="sub">Someone special wants to connect with you on <strong>Evol</strong>.</p>

      <a href="intent://accept-invite?token=${token}#Intent;scheme=evol;package=com.evol;end" 
   class="btn btn-primary">
  Open Evol App 💕
</a>

          <p id="status"></p>

          <a href="https://play.google.com/store/apps/details?id=com.evol"
             class="btn btn-secondary" id="store-btn">
            📲 Download Evol App
          </a>

          <div class="steps">
            <p class="steps-label">What happens next</p>
            <div class="step"><div class="num">1</div><p class="step-text">Tap "Open Evol App" above</p></div>
            <div class="step"><div class="num">2</div><p class="step-text">App opens to connection screen</p></div>
            <div class="step"><div class="num">3</div><p class="step-text">Enter your partner's date of birth</p></div>
            <div class="step"><div class="num">4</div><p class="step-text">You're officially connected! 🎉</p></div>
          </div>

          <p class="footer">🔒 Expires in 24 hours • One-time use only</p>
        </div>

        <script>
          var deepLink  = "${deepLink}";
          var intentUrl = "${intentUrl}";
          var statusEl  = document.getElementById("status");
          var storeBtnEl = document.getElementById("store-btn");

          var ua        = navigator.userAgent;
          var isAndroid = /Android/.test(ua);
          var isIOS     = /iPhone|iPad|iPod/.test(ua);

          // Fix store link for iOS
          if (isIOS) {
            storeBtnEl.href = "https://apps.apple.com/app/evol/id000000000";
            storeBtnEl.textContent = "📲 Download on App Store";
          }

            function openApp() {
              if (isAndroid) {
                window.location.href = intentUrl;
              } else if (isIOS) {
                window.location.href = deepLink;
              }

              // If app not installed, show store button after 2.5s
              setTimeout(function() {
                statusEl.textContent = "App not opening? Download it below 👇";
                storeBtnEl.style.display = "block";
              }, 2500);
            }

          // Auto-attempt when page loads on mobile
          if (isAndroid || isIOS) {
            setTimeout(openApp, 800);
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("handleInviteRedirect error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const disconnectPartner = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.partnerId) {
      return res.status(400).json({
        success: false,
        message: "You are not connected with any partner",
      });
    }

    const partner = await User.findById(user.partnerId);

    // Disconnect user
    user.partnerId = null;
    user.loveStartDate = null;

    // Disconnect partner if they still exist
    if (partner) {
      partner.partnerId = null;
      partner.loveStartDate = null;
      await partner.save();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Partner disconnected successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
