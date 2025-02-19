import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView } from 'react-native'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useHotspotBle, useOnboarding } from '@helium/react-native-sdk'
import { useAsync } from 'react-async-hook'
import { capitalize, times } from 'lodash'
import animalName from 'angry-purple-tiger'
import BackScreen from '../../../components/BackScreen'
import Text from '../../../components/Text'
import Box from '../../../components/Box'
import { RootNavigationProp } from '../../../navigation/main/tabTypes'
import { getMakerSupportEmail } from '../../../makers'
import useDevice from '../../../utils/useDevice'
import Card from '../../../components/Card'
import DiagnosticAttribute from './DiagnosticAttribute'
import DiagnosticLineItem from './DiagnosticLineItem'
import { hp } from '../../../utils/layout'
import Button from '../../../components/Button'
import sendReport from './sendReport'
import ActivityIndicator from '../../../components/ActivityIndicator'
import { HotspotSetupStackParamList } from './hotspotSetupTypes'
import useGetOnboardingRecord from '../../../store/hotspot/useGetOnboardingRecord'

const formatMac = (mac: string) =>
  times(6)
    .map((i) =>
      mac
        .split('')
        .slice(i * 2, i * 2 + 2)
        .join(''),
    )
    .join(':')

type Route = RouteProp<HotspotSetupStackParamList, 'HotspotSetupDiagnostics'>
const HotspotSetupDiagnosticsScreen = () => {
  const {
    params: { gatewayAction },
  } = useRoute<Route>()
  const [diagnosticsError, setDiagnosticsError] = useState('')
  const { t } = useTranslation()
  const { version } = useDevice()
  const rootNav = useNavigation<RootNavigationProp>()
  const { getMinFirmware } = useOnboarding()
  const [lineItems, setLineItems] = useState<
    {
      attribute: string
      value?: string
      showFailure?: boolean
      description?: string
    }[]
  >([])

  const { getDiagnosticInfo, checkFirmwareCurrent, getOnboardingAddress } =
    useHotspotBle()

  const { result: firmware } = useAsync(async () => {
    const min = await getMinFirmware()
    if (!min) return
    return checkFirmwareCurrent(min)
  }, [])

  const { result: address } = useAsync(getOnboardingAddress, [])

  const { result: diagnostics } = useAsync(async () => {
    if (!address || !firmware) return
    try {
      const result = await getDiagnosticInfo()
      return result
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      setDiagnosticsError(String(e))
    }
  }, [address, firmware])

  const getOnboardingRecord = useGetOnboardingRecord()

  const { result: onboardingRecord } = useAsync(async () => {
    if (!address) return
    return getOnboardingRecord(address)
  }, [address])

  const handleClose = useCallback(() => {
    if (gatewayAction === 'diagnostics_wallet_not_linked') {
      rootNav.popToTop()
    } else {
      rootNav.navigate('MainTabs')
    }
  }, [gatewayAction, rootNav])

  const diskIsReadOnly = useMemo(
    () => (diagnostics?.disk || '') === 'read-only',
    [diagnostics?.disk],
  )

  const diskStatus = useMemo(() => {
    switch (diagnostics?.disk) {
      case 'read-only':
        return t('hotspot_settings.diagnostics.disk_read_only')
      case 'ok':
        return t('generic.ok')
      default:
        return t('hotspot_settings.diagnostics.disk_no_data')
    }
  }, [diagnostics?.disk, t])

  const handleSendReport = useCallback(() => {
    const supportEmail = getMakerSupportEmail(onboardingRecord?.maker?.id)
    const descriptionInfo = t('hotspot_settings.diagnostics.desc_info')

    if (!supportEmail) {
      const maker = onboardingRecord?.maker?.name || t('support_alert.maker')
      Alert.alert(
        t('support_alert.title', { maker }),
        t('support_alert.body', { maker }),
      )
      return
    }
    const report = {
      eth: diagnostics?.eth ? formatMac(diagnostics.eth) : '',
      wifi: diagnostics?.wifi ? formatMac(diagnostics.wifi) : '',
      fw: firmware?.deviceFirmwareVersion || '',
      ip: capitalize(diagnostics?.ip || ''),
      disk: diagnostics?.disk || '',
      gateway: address || '',
      hotspotMaker: onboardingRecord?.maker?.name || 'Unknown',
      appVersion: version,
      supportEmail,
      descriptionInfo,
      diagnosticsError,
    }
    sendReport(report)
  }, [
    onboardingRecord,
    t,
    diagnostics,
    firmware?.deviceFirmwareVersion,
    address,
    version,
    diagnosticsError,
  ])

  useEffect(() => {
    setLineItems([
      {
        attribute: t('hotspot_settings.diagnostics.hotspot_type'),
        value: onboardingRecord?.maker?.name || t('generic.unavailable'),
      },
      {
        attribute: t('hotspot_settings.diagnostics.firmware'),
        value: firmware?.deviceFirmwareVersion || t('generic.unavailable'),
      },
      {
        attribute: t('hotspot_settings.diagnostics.app_version'),
        value: version,
      },
      {
        attribute: t('hotspot_settings.diagnostics.wifi_mac'),
        value: diagnostics?.wifi
          ? formatMac(diagnostics.wifi)
          : t('generic.unavailable'),
      },
      {
        attribute: t('hotspot_settings.diagnostics.eth_mac'),
        value: diagnostics?.eth
          ? formatMac(diagnostics.eth)
          : t('generic.unavailable'),
      },
      {
        attribute: t('hotspot_settings.diagnostics.disk'),
        value: diskStatus,
        showFailure: diskIsReadOnly,
        description: diskIsReadOnly
          ? t('hotspot_settings.diagnostics.disk_read_only_instructions')
          : undefined,
      },
      {
        attribute: t('hotspot_settings.diagnostics.nat_type'),
        value: diagnostics?.nat_type
          ? capitalize(diagnostics.nat_type)
          : t('generic.unavailable'),
      },
      {
        attribute: t('hotspot_settings.diagnostics.ip'),
        value: diagnostics?.ip
          ? capitalize(diagnostics.ip)
          : t('generic.unavailable'),
      },
    ])
  }, [
    diagnostics,
    firmware,
    t,
    version,
    onboardingRecord?.maker?.name,
    diskIsReadOnly,
    diskStatus,
  ])

  if (!diagnostics && !diagnosticsError) {
    return (
      <BackScreen
        padding="none"
        backgroundColor="primaryBackground"
        onClose={handleClose}
      >
        <ActivityIndicator />
      </BackScreen>
    )
  }

  return (
    <BackScreen
      padding="none"
      backgroundColor="primaryBackground"
      onClose={handleClose}
    >
      <ScrollView style={{ height: hp(75) }}>
        <Box padding="l" minHeight={413}>
          <Text
            variant="subtitle1"
            fontSize={21}
            color="black"
            marginBottom="s"
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {address ? animalName(address) : ''}
          </Text>

          <Text
            variant="body1"
            fontSize={12}
            color="secondaryText"
            marginBottom="l"
          >
            {t('hotspot_settings.diagnostics.unavailable_warning')}
          </Text>
          <Text
            variant="subtitle1"
            fontSize={15}
            color="black"
            marginBottom="ms"
          >
            {t('hotspot_settings.diagnostics.p2p')}
          </Text>

          <Box flexDirection="row">
            <Card
              variant="regular"
              flex={1}
              marginRight="ms"
              alignItems="center"
            >
              <DiagnosticAttribute
                text={t('hotspot_settings.diagnostics.outbound')}
                success={diagnostics?.connected === 'yes'}
              />
            </Card>

            <Card variant="regular" flex={1} alignItems="center">
              <DiagnosticAttribute
                text={t('hotspot_settings.diagnostics.inbound')}
                success={diagnostics?.dialable === 'yes'}
              />
            </Card>
          </Box>

          <Text
            variant="subtitle1"
            fontSize={15}
            color="black"
            marginBottom="s"
            marginTop="l"
          >
            {t('hotspot_settings.diagnostics.other_info')}
          </Text>
          <Card variant="regular">
            {[
              lineItems.map(
                ({ attribute, value, showFailure, description }) => (
                  <DiagnosticLineItem
                    attribute={attribute}
                    value={value}
                    key={attribute}
                    showFailure={showFailure}
                    description={description}
                  />
                ),
              ),
            ]}
          </Card>

          <Button
            marginTop="lx"
            onPress={handleSendReport}
            variant="primary"
            mode="contained"
            title={t('hotspot_settings.diagnostics.send_to_support')}
          />

          {diagnosticsError && (
            <Text
              variant="subtitle1"
              fontSize={15}
              color="error"
              marginBottom="s"
              marginTop="l"
            >
              {diagnosticsError}
            </Text>
          )}
        </Box>
      </ScrollView>
    </BackScreen>
  )
}

export default HotspotSetupDiagnosticsScreen
