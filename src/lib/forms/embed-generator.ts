import type { LeadForm } from "./types";

export function generateIframeEmbed(form: LeadForm, origin: string): string {
    const url = `${origin}/form/${form.id}`;
    const radius = form.borderRadius !== undefined ? form.borderRadius : 12;
    return `<iframe
  src="${url}"
  width="100%"
  height="620"
  frameborder="0"
  style="border:none; max-width:560px; width:100%; border-radius:${radius}px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1); overflow:hidden; display:block; margin:0 auto;"
  title="${form.title}"
  loading="lazy"
></iframe>`;
}

export function generateCustomHtmlCss(form: LeadForm, origin: string): string {
    const actionUrl = `${origin}/api/forms/${form.id}/submit`;
    const brandColor = form.brandColor || "#10b981";
    const radius = form.borderRadius !== undefined ? `${form.borderRadius}px` : "12px";

    const fieldsHtml = form.fields
        .map((f) => {
            if (f.type === "textarea") {
                return `    <div class="clf-group">
      <label class="clf-label" for="clf-${f.id}">${f.label}${f.required ? ' <span class="clf-req">*</span>' : ""}</label>
      <textarea id="clf-${f.id}" name="${f.id}" class="clf-input clf-textarea" placeholder="${f.placeholder || ""}"${f.required ? " required" : ""}></textarea>
    </div>`;
            } else if (f.type === "select") {
                const opts = (f.options || [])
                    .map((opt) => `        <option value="${opt}">${opt}</option>`)
                    .join("\n");
                return `    <div class="clf-group">
      <label class="clf-label" for="clf-${f.id}">${f.label}${f.required ? ' <span class="clf-req">*</span>' : ""}</label>
      <select id="clf-${f.id}" name="${f.id}" class="clf-input clf-select"${f.required ? " required" : ""}>
        <option value="">Select...</option>
${opts}
      </select>
    </div>`;
            } else {
                return `    <div class="clf-group">
      <label class="clf-label" for="clf-${f.id}">${f.label}${f.required ? ' <span class="clf-req">*</span>' : ""}</label>
      <input type="${f.type}" id="clf-${f.id}" name="${f.id}" class="clf-input" placeholder="${f.placeholder || ""}"${f.required ? " required" : ""}/>
    </div>`;
            }
        })
        .join("\n");

    return `<!-- ============================================================= -->
<!-- WAFlow Lead Capture Form (Custom HTML & CSS Embed)          -->
<!-- Paste this snippet into WordPress, Webflow, Shopify or HTML   -->
<!-- ============================================================= -->

<div id="waflow-lead-box-${form.id}" class="clf-wrapper">
  <form id="waflow-form-${form.id}" class="clf-form">
    <div class="clf-header">
      <h3 class="clf-title">${form.title}</h3>
      ${form.description ? `<p class="clf-desc">${form.description}</p>` : ""}
    </div>

    <div id="clf-alert-${form.id}" class="clf-alert" style="display:none;"></div>

${fieldsHtml}

    <button type="submit" id="clf-btn-${form.id}" class="clf-submit-btn">
      ${form.submitButtonText || "Submit Inquiry"}
    </button>
  </form>
</div>

<style>
  /* Scoped Form Styling — Customize these variables to match your website theme! */
  #waflow-lead-box-${form.id} {
    --clf-brand: ${brandColor};
    --clf-radius: ${radius};
    --clf-bg: #ffffff;
    --clf-text: #1e293b;
    --clf-border: #e2e8f0;
    font-family: inherit;
    width: 100%;
    max-width: 500px;
    margin: 20px auto;
  }
  #waflow-lead-box-${form.id} .clf-form {
    background: var(--clf-bg);
    color: var(--clf-text);
    border: 1px solid var(--clf-border);
    border-radius: var(--clf-radius);
    padding: 28px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);
  }
  #waflow-lead-box-${form.id} .clf-header {
    margin-bottom: 20px;
  }
  #waflow-lead-box-${form.id} .clf-title {
    margin: 0 0 6px 0;
    font-size: 20px;
    font-weight: 700;
  }
  #waflow-lead-box-${form.id} .clf-desc {
    margin: 0;
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
  }
  #waflow-lead-box-${form.id} .clf-group {
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    text-align: left;
  }
  #waflow-lead-box-${form.id} .clf-label {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  #waflow-lead-box-${form.id} .clf-req {
    color: #ef4444;
  }
  #waflow-lead-box-${form.id} .clf-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 14px;
    font-size: 14px;
    border: 1px solid var(--clf-border);
    border-radius: 8px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: #ffffff;
    color: var(--clf-text);
  }
  #waflow-lead-box-${form.id} .clf-input:focus {
    border-color: var(--clf-brand);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }
  #waflow-lead-box-${form.id} .clf-textarea {
    min-height: 80px;
    resize: vertical;
  }
  #waflow-lead-box-${form.id} .clf-submit-btn {
    width: 100%;
    padding: 12px;
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
    background: var(--clf-brand);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  #waflow-lead-box-${form.id} .clf-submit-btn:hover {
    opacity: 0.95;
  }
  #waflow-lead-box-${form.id} .clf-submit-btn:active {
    transform: scale(0.99);
  }
  #waflow-lead-box-${form.id} .clf-alert {
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  ${form.customCss || ""}
</style>

<script>
(function() {
  var f = document.getElementById('waflow-form-${form.id}');
  var b = document.getElementById('clf-btn-${form.id}');
  var a = document.getElementById('clf-alert-${form.id}');
  if (!f) return;

  f.addEventListener('submit', function(e) {
    e.preventDefault();
    b.disabled = true;
    b.innerText = 'Submitting...';
    a.style.display = 'none';

    var data = {};
    new FormData(f).forEach(function(v, k) { data[k] = v; });

    fetch('${actionUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      b.disabled = false;
      b.innerText = '${form.submitButtonText || "Submit Inquiry"}';
      a.style.display = 'block';
      if (res.status) {
        a.style.background = '#ecfdf5';
        a.style.color = '#065f46';
        a.style.border = '1px solid #a7f3d0';
        a.innerHTML = '<strong>Success!</strong> ' + (res.message || 'Inquiry submitted! We will reach out on WhatsApp.');
        f.reset();
        if (res.redirectUrl) {
          setTimeout(function() { window.location.href = res.redirectUrl; }, 1500);
        }
      } else {
        a.style.background = '#fff1f2';
        a.style.color = '#9f1239';
        a.style.border = '1px solid #fecdd3';
        a.innerHTML = '<strong>Error:</strong> ' + (res.message || 'Failed to submit form.');
      }
    })
    .catch(function(err) {
      b.disabled = false;
      b.innerText = '${form.submitButtonText || "Submit Inquiry"}';
      a.style.display = 'block';
      a.style.background = '#fff1f2';
      a.style.color = '#9f1239';
      a.style.border = '1px solid #fecdd3';
      a.innerHTML = '<strong>Network Error:</strong> Please try again later.';
    });
  });
})();
</script>`;
}
