import React, { useState } from 'react'
import { ReactComponent as TextIcon } from '../../../assets/icons/remix/text.svg'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'

const ProjectDescription = ({ description: intro, callback }) => {
  const { t } = useTranslation('projects')
  const [description, setDescription] = useState(intro)
  const [backupDescription, setBackupDescription] = useState()

  const onSave = async () => {
    if (description) {
      await callback(description)
    } else {
      setDescription('❗️ Description can\'t be empty')
      setTimeout(() => {
        setDescription(backupDescription)
      }, 1000)
    }
  }

  return (
    <>
      <div className="editor">
        <div className="left">
          <button disabled>↑</button>
          <figure className="icon-bg"><TextIcon fill="var(--color-fg)" /></figure>
          <button disabled>↓</button>
        </div>
        <div className="center">
          <TextareaAutosize
            minRows={6}
            value={description}
            onClick={() => setBackupDescription(description)}
            onChange={(e) => {
              setDescription(e.target.value)
            }}
            placeholder={`${t('Please add a short description of your project.')} ${t('This field is required before publishing.')}`}
            onBlur={() => onSave()}
          />
        </div>
        <div className="right">
          <button disabled>×</button>
        </div>
      </div>
    </>
  )
}
export default ProjectDescription
