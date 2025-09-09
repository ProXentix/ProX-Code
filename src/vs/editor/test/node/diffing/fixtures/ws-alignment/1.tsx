import { Stack, Text } from '@fluentui/react';
import { View } from '../../layout/layout';

export const WelcomeView = () => {
	return (
		<View title='ProX Code Tools'>
			<Stack grow={true} verticalFill={true}>
				<Stack.Item>
					<Text>
						Welcome to the ProX Code Tools application.
					</Text>
				</Stack.Item>
			</Stack>
		</View>
	);
}
