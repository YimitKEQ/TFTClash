import React from 'react'

function NewsletterSignup(props) {
  var toast = props.toast;
  var email = props.emailRef;
  var submitted = props.submitted;
  var setSubmitted = props.setSubmitted;

  return (
    <div className="bg-surface/90 border border-primary/20 rounded-xl px-5 py-6 text-center">
      <div className="text-[15px] font-bold text-on-surface mb-1.5 font-heading">
        Stay in the Loop
      </div>
      <div className="text-xs text-on-surface-variant mb-3.5 leading-relaxed">
        Weekly recap, upcoming clashes, and meta updates. No spam.
      </div>
      {submitted ? (
        <div className="text-success text-[13px] font-semibold">
          Subscribed! Check your inbox.
        </div>
      ) : (
        <form
          onSubmit={function(e) {
            e.preventDefault();
            var val = email.current && email.current.value;
            if (!val || !val.includes("@")) {
              if (toast) toast("Enter a valid email", "error");
              return;
            }
            try {
              var subs = JSON.parse(localStorage.getItem("tft-newsletter-subs") || "[]");
              if (!subs.includes(val)) {
                subs.push(val);
                localStorage.setItem("tft-newsletter-subs", JSON.stringify(subs));
              }
            } catch (ex) {
              // ignore storage errors
            }
            setSubmitted(true);
            if (toast) toast("Subscribed! Welcome aboard.", "success");
          }}
          className="flex gap-2 max-w-[360px] mx-auto"
        >
          <input
            ref={email}
            type="email"
            placeholder="your@email.com"
            className="flex-1 bg-surface-container border border-on-surface/10 rounded-lg px-3 py-2.5 text-on-surface text-[13px] font-body"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 border-none rounded-lg text-white font-bold cursor-pointer font-body text-[13px] shrink-0 transition-colors"
          >
            Subscribe
          </button>
        </form>
      )}
    </div>
  );
}

export default NewsletterSignup;
