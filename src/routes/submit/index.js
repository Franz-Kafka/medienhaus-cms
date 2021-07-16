import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useHistory, NavLink } from 'react-router-dom'
import Matrix from '../../Matrix'
import { MatrixEvent } from 'matrix-js-sdk'

// components
import Collaborators from './Collaborators'
import Category from './Category'
import DisplayContent from './DisplayContent'
import AddContent from './AddContent'
import ProjectImage from './ProjectImage'
import ProjectTitle from './ProjectTitle'
import PresentType from './PresentType'
import PublishProject from '../../components/PublishProject'
import ProjectDescription from './ProjectDescription'
import { Loading } from '../../components/loading'
import { Trans, useTranslation } from 'react-i18next'

const Submit = () => {
  const { t } = useTranslation('projects')
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocks, setBlocks] = useState([])
  const [isCollab, setIsCollab] = useState(false)
  const [contentLang, setContentLang] = useState('en')
  const [spaceObject, setSpaceObject] = useState()
  const [roomMembers, setRoomMembers] = useState()
  const [saveTimestamp, setSaveTimestamp] = useState('')
  const [medienhausMeta, setMedienhausMeta] = useState([])
  const [description, setDescription] = useState()
  const history = useHistory()
  const matrixClient = Matrix.getMatrixClient()
  const params = useParams()

  const projectSpace = params.spaceId
  const getCurrentTime = useCallback(() => {
    const today = new Date()
    const time = today.getHours().toString().padStart(2, '0') + ':' + today.getMinutes().toString().padStart(2, '0') + ':' + today.getSeconds().toString().padStart(2, '0')
    const date = today.getFullYear() + '-' + today.getMonth().toString().padStart(2, '0') + '-' + today.getDay().toString().padStart(2, '0')
    setSaveTimestamp(date + ', ' + time)
  }, [])

  const reloadSpace = async (roomId) => {
    // roomId is needed in order to invite collaborators to newly created rooms.
    console.log('roomId = ' + roomId)
    // checking to see if the project is a collaboration, if so invite all collaborators and make them admin
    isCollab && roomId && inviteCollaborators(roomId)
    await fetchSpace()
  }

  const inviteCollaborators = async (roomId) => {
    console.log(roomMembers)
    const allCollaborators = Object.keys(roomMembers).filter(userId => userId !== localStorage.getItem('mx_user_id'))
    // const allCollaborators = joinedSpaces?.map((space, i) => space.name === title && Object.keys(space.collab).filter(userId => userId !== localStorage.getItem('mx_user_id') && userId !== process.env.REACT_APP_PROJECT_BOT_ACCOUNT)).filter(space => space !== false)[0]
    // I would be surprised if there isn't an easier way to get joined members...
    const setPower = async (userId) => {
      console.log('changing power level for ' + userId)
      matrixClient.getStateEvent(roomId, 'm.room.power_levels', '').then(async (res) => {
        const powerEvent = new MatrixEvent({
          type: 'm.room.power_levels',
          content: res
        }
        )
        try {
          // something here is going wrong for collab > 2
          await matrixClient.setPowerLevel(roomId, userId, 100, powerEvent)
        } catch (err) {
          console.error(err)
        }
      })
    }
    // invite users to newly created content room
    const invites = allCollaborators?.map(userId => matrixClient.invite(roomId, userId, () => console.log('invited ' + userId)).catch(err => console.log(err)))
    await Promise.all(invites)
    console.log('inviting done, now changing power')
    // then promote them to admin
    const power = allCollaborators.map(userId => setPower(userId))
    await Promise.all(power)
    console.log('all done')
  }

  const fetchSpace = useCallback(async () => {
    // here we collect all necessary information about the project
    const space = await matrixClient.getSpaceSummary(projectSpace)
    // setting title to project space name
    setTitle(space.rooms[0].name)
    setSpaceObject(space)
    // checking if the project is a collaboration
    const getRoomMembers = await matrixClient.getJoinedRoomMembers(space?.rooms[0].room_id)
    setRoomMembers(getRoomMembers.joined)
    // check if project is published or draft
    const joinRule = await fetch(process.env.REACT_APP_MATRIX_BASE_URL + `/_matrix/client/r0/rooms/${space.rooms[0].room_id}/state/m.room.join_rules/`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + localStorage.getItem('medienhaus_access_token') }
    })
    const published = await joinRule.json()
    setVisibility(published.join_rule)
    // fetch custom medienhaus event
    const meta = await matrixClient.getStateEvent(projectSpace, 'dev.medienhaus.meta')
    setMedienhausMeta(meta)
    // we fetch the selected language content
    const spaceRooms = space.rooms.filter(room => room.name === contentLang)
    // and set the topic depending on selected language
    setDescription(spaceRooms[0].topic || '')
    const getContent = await matrixClient.getSpaceSummary(spaceRooms[0].room_id)
    setBlocks(getContent.rooms.filter(room => room.name !== contentLang).filter(room => room.name.charAt(0) !== 'x').sort((a, b) => {
      return a.name.substring(0, a.name.indexOf('_')) - b.name.substring(0, b.name.indexOf('_'))
    }))
    getCurrentTime()
  }, [matrixClient, projectSpace, getCurrentTime, contentLang])

  useEffect(() => {
    projectSpace || setTitle('')
    projectSpace && fetchSpace()
  }, [projectSpace, fetchSpace])

  useEffect(() => {
    if (!projectSpace || !spaceObject) {
      // We do not listen for any room-specific events if we are not currently editing a project
      return
    }

    async function handleRoomTimelineEvent (event) {
      if (event.event.type === 'm.room.message' && blocks?.filter(({ roomId }) => event.event.room_id.includes(roomId)) && event.event.sender !== localStorage.getItem('mx_user_id')) {
        // If a given content block room received a new message, we set the "lastUpdate" property of the appropriate
        // block in "blocks" which will force the given content block to re-render.
        setBlocks((blocks) => {
          const newBlocks = [...blocks]

          return newBlocks.map((block) => {
            if (block.room_id === event.event.room_id) {
              block.lastUpdate = event.event.origin_server_ts
            }

            return block
          })
        })
      }
    }

    async function handleRoomStateEvent (event) {
      /*
      Not sure if still needed, might only update collaborator list and causes trouble
      if (event.event.type === 'm.room.member' && spaceObject.rooms?.filter(({ roomId }) => event.sender?.roomId.includes(roomId)) && event.event.sender !== localStorage.getItem('mx_user_id')) {
        fetchSpace()
      } else
      */
      if (event.event.type === 'm.room.name' && blocks?.filter(({ roomId }) => event.sender?.roomId.includes(roomId))) {
        // listen to room order changes or deletions (room names being changed)
        fetchSpace()
      } else if (event.event.type === 'm.space.child' && event.event.room_id === projectSpace && event.event.sender !== localStorage.getItem('mx_user_id')) {
        // new content room being added
        fetchSpace()
        matrixClient.joinRoom(event.event.state_key)
      }/* else if (event.event.state_key === projectSpace) {
        fetchSpace()
      }
      */
    }

    console.log('subscribe to all room events')
    matrixClient.addListener('Room.timeline', handleRoomTimelineEvent)
    matrixClient.addListener('RoomState.events', handleRoomStateEvent)

    return () => {
      console.log('unsubscribed from all room events')
      matrixClient.removeListener('Room.timeline', handleRoomTimelineEvent)
      matrixClient.removeListener('RoomState.events', handleRoomStateEvent)
    }
  }, [projectSpace, spaceObject, blocks, fetchSpace, matrixClient])

  const listeningToCollaborators = async () => {
    setIsCollab(true)
    try {
      // joining contentRooms which might have been created since we last opened the project
      await matrixClient.getSpaceSummary(projectSpace).then(res => {
        res.rooms.map(async contentRooms => contentRooms.room_id !== projectSpace && await matrixClient.joinRoom(contentRooms.room_id).catch(err => console.log(err)))
      })
    } catch (err) {
      console.error(err)
    }
  }

  const changeProjectImage = (url) => {
    setLoading(true)
    getCurrentTime()
    setLoading(false)
  }

  const startListeningToCollab = () => {
    setIsCollab(true)
    console.log('Started spying on collaborators')
    listeningToCollaborators()
  }

  const changeTitle = (newTitle) => {
    setTitle(newTitle)
  }

  const onChangeDescription = async (description) => {
    // if the selected content language is english we save the description in the project space topic
    contentLang === 'en' && await matrixClient.setRoomTopic(spaceObject.rooms[0].room_id, description).catch(console.log)
    // here we set the description for the selected language space
    const contentRoom = spaceObject.rooms.filter(room => room.name === contentLang)
    const changeTopic = await matrixClient.setRoomTopic(contentRoom[0].room_id, description).catch(console.log)
    fetchSpace()
    // @TODO setSpaceObject(spaceObject => ({...spaceObject, rooms: [...spaceObject.rooms, ]}))
    return changeTopic
  }
  const changePresentationType = (newMedienhausMeta) => {
    console.log(newMedienhausMeta)
    setMedienhausMeta(newMedienhausMeta)
  }
  return (
    <>
      <section className="welcome">
        <p>
          {projectSpace
            ? <strong>{t('Edit project')}</strong>
            : <strong>{t('Create and upload new project')}</strong>}
        </p>
        <p>{t('This is the project page. Please add the context in which the project was created, a project name, descriptive text and a thumbnail. You can also add more images, videos, livestreams and BigBlueButton sessions.')}</p>
        <p><Trans t={t} i18nKey="submitInstructions2">If you want to continue at a later point in time, the project is automatically saved as a draft and you can find it in your collection under <NavLink activeclassname="active" to="/projects">/projects</NavLink>.</Trans></p>
        <p>{t('The Rundgang website will be available in English and German. The project name can only be entered in one language and will therefore be used for both pages. Other texts should ideally be entered in both languages, otherwise the text will appear on both pages in only one language.')}</p>
      </section>
      <section className="project-title">
        <h3>{t('Project Title')}</h3>
        <ProjectTitle title={title} projectSpace={projectSpace} callback={changeTitle} />
      </section>
      {projectSpace && (
        <>
          <section className="context">
            <h3>{t('Project Context')}</h3>
            <Category title={title} projectSpace={projectSpace} />
          </section>
          <section className="present">
            <h3>Type of Presentation</h3>
            <PresentType presentValue={medienhausMeta?.present} projectSpace={projectSpace} callback={changePresentationType} />
          </section>
          <section className="contributors">
            <Collaborators projectSpace={spaceObject?.rooms} members={roomMembers} time={getCurrentTime} startListeningToCollab={() => startListeningToCollab()} />
          </section>
          <section className="project-image">
            <h3>{t('Project image')}</h3>
            {loading ? <Loading /> : <ProjectImage projectSpace={projectSpace} changeProjectImage={changeProjectImage} />}
          </section>
          <section className="content">
            <h3>{t('Content')}</h3>
            <p><Trans t={t} i18nKey="contentInstructions1">You can add elements like texts, images, audio and video files, BigBlueButton sessions and livestreams by clicking the <code>+</code> button near the content block below.</Trans></p>
            <p><Trans t={t} i18nKey="contentInstructions2">The first content block&thinsp;&mdash;&thinsp;which is the introduction to your project&thinsp;&mdash;&thinsp;is required.</Trans></p>
            <p><Trans t={t} i18nKey="contentInstructions3">In all other text content blocks, you can format your input text by highlighting the to be formatted text with your cursor.</Trans></p>
            <p><Trans t={t} i18nKey="contentInstructions4">You can use the <code>↑</code> and <code>↓</code> arrows to rearrange existing blocks.</Trans></p>
            <p><Trans t={t} i18nKey="contentInstructions5">You can provide content and information in multiple languages by setting the desired language in the dropdown list below.</Trans></p>
            <select
              id="subject" name="subject" defaultValue="" value={contentLang} onChange={(e) => {
                setContentLang(e.target.value)
                setDescription()
              }}
            >
              <option value="de">DE — Deutsch</option>
              <option value="en">EN — English</option>
            </select>
            {spaceObject && (description || description === '') ? <ProjectDescription description={description} callback={onChangeDescription} /> : <Loading />}
            {blocks.length === 0
              ? <AddContent number={0} projectSpace={spaceObject?.rooms.filter(room => room.name === contentLang)[0].room_id} blocks={blocks} reloadSpace={reloadSpace} present={medienhausMeta?.present} />
              : blocks.map((content, i) =>
                <DisplayContent block={content} index={i} blocks={blocks} projectSpace={spaceObject?.rooms.filter(room => room.name === contentLang)[0].room_id} reloadSpace={reloadSpace} time={getCurrentTime} present={medienhausMeta?.present} key={content + i + content?.lastUpdate} />
              )}
          </section>
          <section className="visibility">
            <h3>{t('Visibility')}</h3>
            <p>
              <Trans t={t} i18nKey="visibilityInstructions1">
                Would you like to save your project as a draft or release it for publishing on the Rundgang platform? The released projects will be published for the Rundgang on October 29, 2021.
              </Trans>
            </p>
            <p>{t('If you still want to make changes to your contributions after publishing, you can continue to do so. Please note, however, that content on analogue and hybrid projects will be pulled from the system on October 8, 2021 for the printed Rundgang programme. Projects that have not been approved by you for publishing by then will not be included in the programme booklet.')}</p>
            <p><em>{t('Please note: The frontend, i.e. the website where all projects will be visible, is still under construction. Therefore, at the moment it is not yet possible to preview the created projects.')}</em></p>
            {spaceObject ? <PublishProject space={spaceObject.rooms[0]} description={spaceObject.rooms[0].topic} published={visibility} time={getCurrentTime} /> : <Loading />}
          </section>
          <section className="save">
            <button onClick={() => history.push('/projects')}>← {t('BACK TO OVERVIEW')}</button>
            {saveTimestamp && <p className="timestamp">↳ {t('Project last saved at')} {saveTimestamp}</p>}
          </section>
        </>
      )}
    </>
  )
}

export default Submit
