import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Trans, useTranslation } from 'react-i18next'
import { useAuth } from '../../Auth'
import { makeRequest } from '../../Backend'

const Feedback = () => {
  const { register, formState: { errors }, handleSubmit } = useForm()
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation('feedback')

  const auth = useAuth()
  const profile = auth.user

  const changeMsg = e => setMsg(e.target.value)

  const onSubmit = async () => {
    setSending(true)
    const support =
      {
        displayname: profile.displayname,
        msg: msg
      }
    try {
      await makeRequest('messenger/feedback', support)
        .then(msg => {
          console.log(msg)
        })
      setSending(false)
      setSubmitted(true)
      setMsg('')
    } catch (e) {
      console.log(e)
      alert('Couldn’t send your message. ' + e)
      setSending(false)
    }
  }

  if (submitted) {
    return (
      <section>
        <p><Trans t={t} i18nKey="submittedMessage">Thank you for your feedback! We are collecting your feedback and will evaluate it after the Rundgang 2021. If you need technical help with entering your contributions, please reach out via the <NavLink to="/support">/support</NavLink> form.</Trans></p>
      </section>
    )
  }
  return (
    <>
      <section className="support">
        <p>{t('As the platform is a new tool that can continue to enrich the Rundgang – Open Days in the future, we would be happy if you send us your feedback on how to handle the system.')}</p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <textarea {...register('messageInput', { required: true })} name="messageInput" placeholder={t('Your feedback …')} rows="7" spellCheck="true" value={msg} onChange={changeMsg} />
          {errors?.messageInput && 'This field can’t be empty.'}
          <button type="submit" disabled={sending}>{t('SUBMIT')}</button>
        </form>
      </section>
    </>
  )
}

export default Feedback
