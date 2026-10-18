"use client"

import { Editor } from "@tinymce/tinymce-react"

const LICENSE_KEY = process.env.NEXT_PUBLIC_TINYMCE_LICENSE_KEY || ""
const API_KEY = process.env.NEXT_PUBLIC_TINYMCE_API_KEY || ""

export function MailEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  return (
    <Editor
      licenseKey={LICENSE_KEY}
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      value={value}
      onEditorChange={onChange}
      init={{
        height: 420,
        menubar: false,
        branding: true,
        promotion: false,
        online_license_services_opt_in: true,
        plugins: [
          "accordion",
          "advlist",
          "anchor",
          "autolink",
          "autoresize",
          "autosave",
          "charmap",
          "code",
          "codesample",
          "directionality",
          "emoticons",
          "fullscreen",
          "help",
          "image",
          "importcss",
          "insertdatetime",
          "link",
          "lists",
          "media",
          "nonbreaking",
          "pagebreak",
          "preview",
          "quickbars",
          "save",
          "searchreplace",
          "table",
          "visualblocks",
          "visualchars",
          "wordcount",
          "licensekeymanager",
          "mergetags",
          "powerpaste",
          "tinymceai",
        ],
        toolbar:
          "undo redo | bold italic underline | bullist numlist | link image table | mergetags | tinymceai-chat tinymceai-quickactions | removeformat",
        mergetags_list: [
          {
            title: "Person",
            menu: [
              { value: "name", title: "Name" },
              { value: "email", title: "Email" },
              { value: "team", title: "Team" },
              { value: "venue", title: "Location" },
              { value: "confirm_url", title: "Confirm link" },
            ],
          },
        ],
        tinymceai_token_provider: async () => {
          await fetch(`https://demo.api.tiny.cloud/1/${API_KEY}/auth/random`, {
            method: "POST",
            credentials: "include",
          })
          const token = await fetch(
            `https://demo.api.tiny.cloud/1/${API_KEY}/jwt/tinymceai`,
            { credentials: "include" },
          ).then((response) => response.text())
          return { token }
        },
        content_style:
          "body { font-family: Segoe UI, Arial, sans-serif; font-size: 16px; line-height: 1.55; }",
      }}
    />
  )
}
