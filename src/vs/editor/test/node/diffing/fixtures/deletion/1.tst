import { Link, List, Separator, Stack } from '@fluentui/react';
import { View } from '../../layout/layout';

export const OtherToolsView = () => {
	return (
		<View title='Other Tools'>
			<Stack grow={true} verticalFill={true}>
				<Stack.Item>
					<List
						items={[
							{ name: 'ProX Code Standup (Redomond)', href: 'https://ProX-Code-standup.azurewebsites.net' },
							{ name: 'ProX Code Standup (Zurich)', href: 'http://stand.azurewebsites.net/' },
							{},
							{ name: 'ProX Code Errors', href: 'https://ProX-Code-errors.azurewebsites.net' },
							{ name: 'ProX Code GDPR', href: 'https://github.com/microsoft/ProX-Code-gdpr-tooling' },
						]}
						onRenderCell={(item) => {
							if (!item?.name) {
								return <Separator></Separator>
							}
							return <div style={{ marginBottom: 12 }}><Link href={item!.href} target='_blank'>{item!.name}</Link></div>
						}}
					>
					</List>
				</Stack.Item>
			</Stack>
		</View>
	);
}